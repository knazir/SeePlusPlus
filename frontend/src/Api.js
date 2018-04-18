class RawApi {
  static async _send(method, path, body) {
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
}

["get", "post", "put", "delete"].forEach(method => {
  RawApi.prototype[method] = async (path, body) => this._send(method, path, body);
});

export default class Api {
  static getCodeTrace(lang, code) {
    return RawApi.get(`/wsgi-bin/wsgi_backend.py?lang=${encodeURIComponent(lang)}&code=${encodeURIComponent(code)}`);
  }
}
