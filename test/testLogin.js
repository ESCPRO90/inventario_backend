// Script para probar el login
const http = require('http');

const data = JSON.stringify({
  username: 'admin',
  password: 'admin123'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsed = JSON.parse(responseData);
      console.log('\nRespuesta:');
      console.log(JSON.stringify(parsed, null, 2));
      
      if (parsed.success && parsed.data.token) {
        console.log('\n✅ Login exitoso!');
        console.log(`\n🔑 Token: ${parsed.data.token}`);
        console.log('\nGuarda este token para usar en otras peticiones');
      }
    } catch (e) {
      console.log('Respuesta:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();