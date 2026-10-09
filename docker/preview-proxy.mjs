import http from 'node:http';
import net from 'node:net';

// Only this dependency-free process bridges localhost and the internal dev network.
const server = http.createServer((request, response) => {
  const upstream = http.request(
    {
      hostname: 'dev',
      port: 4200,
      path: request.url,
      method: request.method,
      headers: request.headers,
    },
    (incoming) => {
      response.writeHead(incoming.statusCode, incoming.headers);
      incoming.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502);
    response.end('Preview is starting. Refresh in a moment.');
  });
  request.on('error', () => upstream.destroy());
  response.on('close', () => upstream.destroy());
  request.pipe(upstream);
});

// Vite's live reload needs the same route for its WebSocket connection.
server.on('upgrade', (request, client, head) => {
  const upstream = net.connect(4200, 'dev', () => {
    upstream.write(`${request.method} ${request.url} HTTP/${request.httpVersion}\r\n`);
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      upstream.write(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}\r\n`);
    }
    upstream.write('\r\n');
    if (head.length) upstream.write(head);
    client.pipe(upstream).pipe(client);
  });
  upstream.on('error', () => client.destroy());
  client.on('error', () => upstream.destroy());
  client.on('close', () => upstream.destroy());
});

server.listen(4200, '0.0.0.0');
