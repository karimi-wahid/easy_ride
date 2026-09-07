const { io } = require('socket.io-client');

const DRIVER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwYWZhOTdjMi03MzZkLTRhZDEtYmNjMC00NzJkZmU0MjNlZjIiLCJwaG9uZSI6Iis5Mzc4ODg4ODg4OCIsInNpZCI6IjQwY2Q3N2MxLTNhNWEtNGI4OS1iOTE4LWFkMTg1MzEyM2M1ZCIsImlhdCI6MTc4ODc2MTE4OCwiZXhwIjoxNzg4NzYyMDg4fQ.BbF8Rdf_WNSQHvWOaODXkafyhft2xGTlm7Szfrx8BO8';

const socket = io('http://localhost:3000/rides', {
  auth: {
    token: DRIVER_TOKEN,
  },
});

socket.on('connect', () => {
  console.log('DRIVER CONNECTED');
  console.log('socketId:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('DRIVER CONNECTION ERROR:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('DRIVER DISCONNECTED:', reason);
});

socket.on('ride:offer', (data) => {
  console.log('🚕 DRIVER RECEIVED RIDE OFFER');
  console.log(data);
});

socket.on('ride:accepted', (data) => {
  console.log('RIDE ACCEPTED');
  console.log(data);
});

socket.on('driver:location', (data) => {
  console.log('DRIVER LOCATION');
  console.log(data);
});
