//Load HTTP module
const http = require("http");
const ejs = require("ejs");
const hostname = "127.0.0.1";
const port = 3000;

console.log("STARTING____");


//Create HTTP server and listen on port 3000 for requests
const server = http.createServer((req, res) => {
  //Set the response HTTP header with HTTP status and Content type
  console.log("Incoming request received");
  var utcDateString = (new Date()).toUTCString()
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html");
  let html = ejs.render(`<html><body><h1>Hello World</h1><p>Date is <%=date %></p></body></html>`, {date: utcDateString });
  res.end(html);
  console.log("Response sent:", html )
});

//listen for request on port 3000, and as a callback function have the port listened on logged
server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});