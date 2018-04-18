class RawApi {
  static async _send(method, path, body = null) {
    const opts = {
      method: method,
      credentials: "include",
      headers: {}
    };

    if (body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(path, opts);
    let json;
    try {
      json = await res.json();
    } catch (e) {
      const text = e.message ? e.message : await res.text();
      throw new Error(`API: Non-JSON response to ${path}: ${text}`);
    }
    return json;
  }

  static async get(path) {
    return RawApi._send("get", path);
  }
}

export default class Api {
  static getCodeTrace(lang, code) {
    return RawApi.get(`/wsgi-bin/wsgi_backend.py?lang=${encodeURIComponent(lang)}&code=${encodeURIComponent(code)}`);
  }
}
