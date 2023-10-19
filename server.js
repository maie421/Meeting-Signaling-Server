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
    console.log('Client connected');
    //방 참가
    socket.on("join_room", (roomName, name) => {
        joinRoom(roomName, name, socket);
    });
    socket.on("offer", (offer, roomName) => {
        console.info("offer");
        socket.to(roomName).emit("offer", offer);
    });
    socket.on("answer", (answer, roomName) => {
        console.info("answer");
        socket.to(roomName).emit("answer", answer, socket.id);
    });
    socket.on("ice", (ice, roomName) => {
        console.info("ice");
        if (ice != null) {
            socket.to(roomName).emit("ice", ice);
        }
    });

    socket.on("leave_room", (roomName, name) => {
        console.info("leave_room");
        delete rooms[roomName]?.participants[name];
        socket.to(roomName).emit("leave_room", name);
        socket.leave(roomName);
        // removeClientFromRooms(socket, name);
    });

    socket.on('close', (code, reason) => {
        console.log(`Client disconnected with code: ${code}, reason: ${reason}`);
    });

    socket.on('error', (error) => {
        console.error(`Error occurred: ${error.message}`);
    });

    // socket.on("disconnect", () => {
    //     console.log(`Client disconnected`);
    // })
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
    socket.to(roomName).emit("welcome", room, socket.id);
}

function removeClientFromRooms(socket, name) {
    // 클라이언트가 연결을 끊을 때 해당 클라이언트를 모든 방(Room)에서 제거
    for (const roomName in rooms) {
        if (rooms[roomName].participants[name] === socket.id) {
            delete rooms[roomName].participants[name];
            socket.leave(roomName);
        }
    }
}