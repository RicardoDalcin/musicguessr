import io from "socket.io-client";
const socket = io("http://localhost:3000");

export async function POST(req: Request) {
  try {
    // do something you need to do in the backend
    // (like database operations, etc.)

    socket.emit("message1", "Sync Process Completed");

    return Response.json({ data: "Success" }, { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return Response.json({ error: error }, { status: 200 });
  }
}

