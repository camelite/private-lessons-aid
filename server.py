import json
import os
from flask import Flask, jsonify, request, send_from_directory
import requests
import certifi
import ssl
import subprocess
from urllib3.poolmanager import PoolManager
from requests.adapters import HTTPAdapter


class TLS12Adapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        context = ssl.create_default_context()
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_2
        pool_kwargs["ssl_context"] = context
        self.poolmanager = PoolManager(
            num_pools=connections, maxsize=maxsize, block=block, **pool_kwargs
        )

app = Flask(__name__, static_folder=".", static_url_path="")


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


@app.route("/api/llm", methods=["POST"])
def llm():
    payload = request.get_json(force=True)
    prompt = payload.get("prompt", "")
    debug = bool(payload.get("debug"))
    settings = payload.get("settings", {}) or {}

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"error": "Missing OPENAI_API_KEY"}), 400

    model = settings.get("model") or "gpt-4.1-mini"
    max_output_tokens = int(settings.get("maxOutputTokens") or 20000)
    reasoning_effort = settings.get("reasoningEffort") or "off"
    timeout_connect = int(settings.get("timeoutConnect") or 10)
    timeout_read = int(settings.get("timeoutRead") or 180)

    request_body = {
        "model": model,
        "max_output_tokens": max_output_tokens,
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt,
                    }
                ],
            }
        ],
    }

    if reasoning_effort and reasoning_effort != "off":
        request_body["reasoning"] = {"effort": reasoning_effort}

    response = None
    try:
        session = requests.Session()
        session.trust_env = False
        session.mount("https://", TLS12Adapter())
        response = session.post(
            "https://api.openai.com/v1/responses",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=request_body,
            timeout=(timeout_connect, timeout_read),
            verify=certifi.where(),
        )
    except requests.exceptions.SSLError:
        response = None

    if response is None:
        response = call_with_curl(api_key, request_body, timeout_read)

    if isinstance(response, dict):
        data = response
    else:
        if response.status_code >= 400:
            return jsonify({"error": response.text}), response.status_code
        data = response.json()
    text = extract_text(data)

    if debug:
        return jsonify({"text": text, "raw": data})

    return jsonify({"text": text})


@app.route("/api/models", methods=["POST"])
def models():
    payload = request.get_json(force=True) or {}
    settings = payload.get("settings", {}) or {}
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"error": "Missing OPENAI_API_KEY"}), 400

    timeout_connect = int(settings.get("timeoutConnect") or 10)
    timeout_read = int(settings.get("timeoutRead") or 180)
    request_body = {}

    response = None
    try:
        session = requests.Session()
        session.trust_env = False
        session.mount("https://", TLS12Adapter())
        response = session.get(
            "https://api.openai.com/v1/models",
            headers={
                "Authorization": f"Bearer {api_key}",
            },
            timeout=(timeout_connect, timeout_read),
            verify=certifi.where(),
        )
    except requests.exceptions.SSLError:
        response = None

    if response is None:
        data = call_with_curl_models(api_key, timeout_read)
    else:
        if response.status_code >= 400:
            return jsonify({"error": response.text}), response.status_code
        data = response.json()

    models = [item.get("id") for item in data.get("data", []) if item.get("id")]
    return jsonify({"models": models})


def call_with_curl(api_key, request_body, timeout_read):
    payload = json.dumps(request_body)
    command = [
        "curl.exe",
        "-sS",
        "-X",
        "POST",
        "https://api.openai.com/v1/responses",
        "-H",
        f"Authorization: Bearer {api_key}",
        "-H",
        "Content-Type: application/json",
        "--data",
        payload,
    ]
    result = subprocess.run(
        command, capture_output=True, text=True, timeout=timeout_read + 30
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or "curl failed")
    return json.loads(result.stdout)


def call_with_curl_models(api_key, timeout_read):
    command = [
        "curl.exe",
        "-sS",
        "-X",
        "GET",
        "https://api.openai.com/v1/models",
        "-H",
        f"Authorization: Bearer {api_key}",
    ]
    result = subprocess.run(
        command, capture_output=True, text=True, timeout=timeout_read + 30
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or "curl failed")
    return json.loads(result.stdout)


def extract_text(data):
    if isinstance(data, dict) and data.get("output_text"):
        return data.get("output_text")

    seen = set()
    results = []

    def walk(node):
        if isinstance(node, dict):
            if "text" in node and isinstance(node["text"], str):
                if node["text"] not in seen:
                    seen.add(node["text"])
                    results.append(node["text"])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(data)
    return "\n".join(results).strip()


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port)

