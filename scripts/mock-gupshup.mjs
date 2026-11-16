import http from "node:http";
let n = 0;
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url.startsWith("/sm/api/v1/template/list/") || /^\/wa\/app\/[^/]+\/template/.test(req.url)) {
      return res.end(JSON.stringify({ status: "success", templates: [
        { id: "tpl-1", elementName: "order_update", languageCode: "en", category: "UTILITY", status: "APPROVED", templateType: "TEXT", data: "Hi {{1}}, your order {{2}} is on the way.", containerMeta: JSON.stringify({ data: "Hi {{1}}, your order {{2}} is on the way.", footer: "Reply STOP to opt out" }) },
        { id: "tpl-2", elementName: "promo_image", languageCode: "en", category: "MARKETING", status: "APPROVED", templateType: "IMAGE", data: "Hello {{1}}! New arrivals are here.", containerMeta: JSON.stringify({ data: "Hello {{1}}! New arrivals are here." }) },
        { id: "tpl-3", elementName: "pending_one", languageCode: "en", status: "PENDING", templateType: "TEXT", data: "x" },
      ]}));
    }
    const p = new URLSearchParams(body);
    const id = "gs-" + (++n) + "-" + Math.random().toString(36).slice(2);
    if (p.get("destination") === "919999999999") { res.statusCode = 400; return res.end(JSON.stringify({ status: "error", message: "Invalid destination" })); }
    console.log("send", n, p.get("destination"), p.get("template") ?? p.get("message"));
    setTimeout(() => res.end(JSON.stringify({ status: "submitted", messageId: id })), 30);
  });
}).listen(4010, () => console.log("mock on 4010"));
