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
    socket.on("offer", (offer, roomName, from, tofrom) => {
        //tofrom 보낸사람
        //from 받아 야 하는 사람
        console.info("offer: " + from);
        wsServer.to(rooms[roomName].participants[from]).emit("offer", offer, from, socket.id, tofrom, rooms[roomName].host);
    });
    socket.on("answer", (answer, roomName , from, socketId) => {
        console.info("answer socketId from : " + socketId);
        wsServer.to(socketId).emit("answer", answer, from);
        // socket.to(roomName).emit("answer", answer, from, rooms);
    });
    socket.on("ice", (ice, roomName) => {
        // console.info("ice: " + socket.id);
        if (ice != null) {
            socket.to(roomName).emit("ice", ice);
        }
    });

    socket.on("leave_room", (roomName, name) => {
        delete rooms[roomName]?.participants[name];

        if (rooms[roomName]?.host === name){
            rooms[roomName].host = Object.keys(rooms[roomName].participants)[0];
            if (rooms[roomName].host) {
                console.info(`changeHost : ${rooms[roomName].host}`);
                wsServer.to(rooms[roomName].participants[rooms[roomName].host]).emit("change_host");
            }
        }

        console.info(`leave_room : ${JSON.stringify(rooms[roomName])}`);
        socket.to(roomName).emit("leave_room", name, rooms[roomName]?.host);
        socket.leave(roomName);
    });

    socket.on("recorder_room", (roomName) => {
        console.info("recorder_room : 들어옴");
        socket.to(roomName).emit("recorder_room", roomName);
    });

    socket.on("stop_recorder_room", (roomName, from) => {
        console.info("stop_recorder_room : 들어옴");
        socket.to(roomName).emit("stop_recorder_room", roomName);
    });

    socket.on("stop_screen_room", (roomName, from) => {
        console.info("stop_screen_room : 들어옴");
        socket.to(roomName).emit("stop_screen_room", roomName);
    });

    socket.on("recorder_name", (roomName, from) => {
        console.info("recorder_room : 들어옴");
        wsServer.to(rooms[roomName].participants[from]).emit("recorder_name", roomName);
    });

    socket.on('close', (code, reason) => {
        console.log(`Client disconnected with code: ${code}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
        console.error(`Error occurred: ${error.message}`);
    });

    socket.on("send_android_message", (roomName, msg) => {
        socket.to(roomName).emit("send_android_message", msg);
    });

    socket.on("send_web_message", (roomName, msg) => {
        socket.to(roomName).emit("send_web_message", msg);
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

