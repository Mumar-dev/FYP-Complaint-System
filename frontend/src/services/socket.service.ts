import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io('http://localhost:5000', {
      withCredentials: true,
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const joinUserRoom = (userId: string) => {
  const s = getSocket();
  if (s && userId) {
    s.emit('join_user_room', userId);
  }
};
