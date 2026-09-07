const { io } = require('socket.io-client');

const USER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkZjY3NDkyMS0xNDgxLTRlZmMtYTJiZS1kMmQzZjBjY2Q1NzIiLCJwaG9uZSI6Iis5MzcxMjI0NTc1NSIsInNpZCI6IjU4ZGQyZTlhLTdmOWItNDM0ZC05MGEyLTgyNjQyNGRjNmQ4ZCIsImlhdCI6MTc4ODc2MTQyMSwiZXhwIjoxNzg4NzYyMzIxfQ.qPHo6TNUnOjhodRW9s3xl6jjIaS9IZX071NZHo_3cls';

const socket = io('http://localhost:3000/rides', {
  auth: {
    token: USER_TOKEN,
  },
});

socket.on('connect', () => {
  console.log('USER CONNECTED');
  console.log('socketId:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('USER CONNECTION ERROR:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('USER DISCONNECTED:', reason);
});

socket.on('ride:accepted', (data) => {
  console.log('👤 USER RECEIVED RIDE ACCEPTED');
  console.log(data);
});

socket.on('driver:location', (data) => {
  console.log('📍 USER RECEIVED DRIVER LOCATION');
  console.log(data);
});

socket.on('ride:state_changed', (data) => {
  console.log('RIDE STATE CHANGED');
  console.log(data);
});
