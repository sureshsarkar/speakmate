// Tiny holder so services can emit to sockets without importing the socket layer (avoids cycles).
let ioRef = null;
export const setIo = (io) => {
  ioRef = io;
};
export const getIo = () => ioRef;

export const emitToActor = (publicId, event, payload) => {
  if (ioRef) ioRef.to(`actor:${publicId}`).emit(event, payload);
};
export const emitToSocket = (socketId, event, payload) => {
  if (ioRef && socketId) ioRef.to(socketId).emit(event, payload);
};
