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
// app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer);

// 웹 소켓 서버에서 연결 이벤트를 처리하는 부분
let rooms = {};

wsServer.on("connection", (socket) => {
    //방 참가
    socket.on("join_room", (roomName, name) => {
        joinRoom(roomName, name, socket);
    });
    socket.on("offer", (offer, roomName, from) => {
        console.info("offer: " + from);
        //join 한 나한테만 오도록 수정
        wsServer.to(rooms[roomName].participants[from]).emit("offer", offer, from, socket.id);
    });
    socket.on("answer", (answer, roomName , from, socketId) => {
        console.info("answer socketId from : " + socketId);
        wsServer.to(socketId).emit("answer", answer, from, rooms);
        // socket.to(roomName).emit("answer", answer, from, rooms);
    });
    socket.on("ice", (ice, roomName) => {
        console.info("ice: " + socket.id);
        if (ice != null) {
            socket.to(roomName).emit("ice", ice);
        }
    });

    socket.on("leave_room", (roomName, name) => {
        console.info("leave_room");
        delete rooms[roomName]?.participants[name];
        socket.to(roomName).emit("leave_room", name);
        socket.leave(roomName);
    });

    socket.on('close', (code, reason) => {
        console.log(`Client disconnected with code: ${code}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
        console.error(`Error occurred: ${error.message}`);
    });

});
const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);

function joinRoom(roomName, name, socket) {
    let room = rooms[roomName];

    if (room == null) {
        room = {
            name: roomName,
            host: name,
            participants: {}, //참가자들
        };
        rooms[roomName] = room;
        rooms[roomName].participants[name] = socket.id;
        console.log(`create new room : ${JSON.stringify(room)}`);
    } else {
        rooms[roomName].participants[name] = socket.id;
        console.log(`get existing room : ${JSON.stringify(room)}`);
    }

    socket.join(roomName);
    socket.to(roomName).emit("welcome", room, name);
}