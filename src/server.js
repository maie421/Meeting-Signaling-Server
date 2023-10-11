import * as http from "http";
import path from "path";
import { Server } from "socket.io";
import express from "express";

const app = express();
const __dirname = path.resolve();

app.set("view engine", "pug");
app.set("views", process.cwd() + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

// 웹 소켓 서버에서 연결 이벤트를 처리하는 부분
wsServer.on("connection", (socket) => {
    //방 참가
    socket.on("join_room", (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit("welcome");
    });
    socket.on("offer", (offer, roomName) => {
        socket.to(roomName).emit("offer", offer);
    });
    socket.on("answer", (answer, roomName) => {
        socket.to(roomName).emit("answer", answer);
    });
    socket.on("ice", (ice, roomName) => {
        socket.to(roomName).emit("ice", ice);
    });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);
