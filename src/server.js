import path from "path";
import express from "express";
import { WebSocketServer } from 'ws';
import * as https from "https";
import fs from "fs"; // Import WebSocket

const options = {
  key: fs.readFileSync('../keys/server.key'),
  cert: fs.readFileSync('../keys/server.crt')
};

const app = express();
const __dirname = path.resolve();

app.set("view engine", "pug");
app.set("views", process.cwd() + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

let server = https.createServer(options, app).listen(3000, () => {
  console.log('https://localhost:3000/');
});


const wsServer = new WebSocketServer({server});

// 웹 소켓 서버에서 연결 이벤트를 처리하는 부분
wsServer.on('connection', ws => {
  ws.on('error', error => {
    console.error(`Connection %s error : %s`, ws.id, error);
  });

  ws.on('disconnect', data => {
    console.log(`Connection : %s disconnect`, data);
  });
  ws.on('message', _message => {
    let message = JSON.parse(_message);
    console.log(`Connection: %s id`, message.id);

    switch (message.id) {
      case 'join_room':
        console.log("join_room"+ message);
        break;
      case 'offer': //보낸 사람으로 부터 비디오 수신
        console.log("offer"+ message);
        break;
      case 'answer':
        console.log("answer"+ message);
        break;
      case 'leave':
        console.log("leave"+ message);
        break;
      case 'ice':
        console.log("ice"+ message);
        break;
    }
  });
});

// const handleListen = () => console.log(`Listening on http://localhost:3000`);
// httpServer.listen(3000, handleListen);
