var http = require('http');
var server = http.createServer();
var fs = require('fs');
var url = require('url');
var path = require('path');

var message = {
    200: 'OK',
    404: 'Not Found',
    500: 'Internal Server Error',
    501: 'Not Implemented'
};

var mime = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain'
};

function responseFile(res, filePath) {
    var stream = fs.createReadStream(filePath);

    // stream がデータの断片を読み取り可能になった時に発火
    stream.on('readable', function () {
        res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'text-plain' });
    });

    // データの読み込みが完了するタイミングでコールバック関数に渡される
    stream.on('data', function (chunk) {
        res.write(chunk);
    });

    // データを完全に読み込み終わった時に発火
    stream.on('end', function () {
    });

    // ファイルがクローズされた時に発火
    stream.on('close', function () {
        res.end();
    });

    stream.on('error', function (err) {
        console.log(err);
        responseError(res, 500);
    });
}

function responseError(res, statusCode) {
    res.writeHead(statusCode, { 'Content-Type': 'text/plan' });
    res.end(message[statusCode]);
}

server.on('request', function (req, res) {
    // urlモジュールを使って分割する
    var pathName = url.parse(req.url).pathname;
    var filePath = __dirname + pathName;

    if (req.method != 'GET') {
        responseError(res, 500);
        return;
    }

    // ファイルの情報取得
    fs.stat(filePath, function (err, stats) {
        if (err) {
            console.log(err);
            return;
        }

        if (stats.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
        }

        responseFile(res, filePath);
    });
});


// クライアントからHTTP/1.1のUpgradeリクエスト受信時に発火
server.on('upgrade', function (req, socket, head) {
    var key = req.headers['sec-websocket-key'];
    var connectValue = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    // [Sec-WebSocket-Accept]フィールドの値の求め方
    // Sec-WebSocket-Key(key) の末尾の空白を覗いた値を準備
    // key に固定値 "258EAFA5-E914-47DA-95CA-C5AB0DC85B11" を連結
    // sha1 を取得
    // base64 に変換
    var acceptValue = require('crypto').createHash('sha1').update(key + connectValue).digest('base64');

    // レスポンスヘッダ(HTTPの規約でヘッダとボディの区切り子に空行を入れる)
    var responseHeader = 'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + acceptValue + '\r\n' +
        'Sec-WebSocket-Protocol: chat\r\n' +
        '\r\n';

    // WebSocketへのアップグレードに対してのレスポンス
    socket.write(responseHeader);

    // クライアント sendメソッドにより発火(バイナリ形式のデータフレームでやり取り)
    socket.on('data', function (frame) {
        console.log('');
        console.log('--- frame ---');
        console.log(frame);
        console.log('');


        console.log('--- 1byte ---');
        var firstByte = frame[0];

        // [1byte] 1bit
        console.log('Fin[1] : ' + (firstByte & 0x80).toString(2));

        // [1byte] 1bitづつ
        console.log('Rsv1[1] : ' + (firstByte & 0x40).toString(2));
        console.log('Rsv2[1] : ' + (firstByte & 0x20).toString(2));
        console.log('Rsv3[1] : ' + (firstByte & 0x10).toString(2));

        // [1byte] 4bit
        var opcode = firstByte & 0x0F;
        console.log('Opcode[4] : ' + opcode.toString(2));
        console.log('');


        console.log('--- 2byte --- ');
        var secondByte = frame[1];

        // [2byte] 1bit
        console.log('Mask[1] : ' + (secondByte & 0x80).toString(2));

        // [2byte] 7, 7+16, 7+64 bitのいずれか
        var payloadLength = secondByte & 0x7F;
        console.log('PayloadLength[7] : ' + payloadLength + 'byte');

        // Payload長 0-125 のみ対応
        if (payloadLength === 126) {
            console.log('Next 16bit is PayloadLength. But not supported');
            return;
        } else if (payloadLength === 127) {
            console.log('Next 64bit is PayloadLength. But not supported');
            return;
        }
        console.log('');


        console.log('--- 3byte ~ 6byte ---');
        // [3byte ~ 6byte] 32bit
        var maskKey = frame.slice(2, 6);
        console.log('Masking-key[32] : ');
        console.log(maskKey);
        console.log('');


        console.log('--- 7byte ~ end ---');
        // [7byte ~ 最後まで] PayloadData
        var payload = frame.slice(6, frame.length);
        console.log('Payload[' + (payloadLength * 8) + '] :');
        console.log(payload);

        var unmaskedPayload = unmask(maskKey, payloadLength, payload);
        // unmaskしたPayload
        console.log('UnmaskedPayload : ');
        console.log(unmaskedPayload);
        console.log(unmaskedPayload.toString());
        console.log('');


        console.log('--- send data to cliant ---');
        // クライアントに送信するフレーム
        // 1byte: FIN, RSV1-3, OPCODE
        // 2byte: MASK, Payload長
        // 3byte以降: PayloadData(unmasked)
        var sendFrame = new Buffer(2 + payloadLength);

        sendFrame[0] = firstByte;
        sendFrame[1] = payloadLength;
        for (var i = 0; i < payloadLength; i++) {
            sendFrame[i + 2] = unmaskedPayload[i];
        }
        console.log(sendFrame);

        // クライアントに送信
        socket.end(sendFrame);
    })
});

// マスクされたペイロードをアンマスクして返却
function unmask(maskKey, payloadLength, payload) {
    // 4byteづつ処理
    var maskNum = maskKey.readUInt32BE(0, true);
    var i = 0;
    for (; i < payloadLength - 3; i += 4) {
        var single = maskNum ^ payload.readUInt32BE(i, true);
        if (single < 0) single = 4294967296 + single;
        payload.writeUInt32BE(single, i, true);
    }

    // 余りを処理
    switch (payloadLength % 4) {
        case 3: payload[i + 2] = payload[i + 2] ^ maskKey[2];
        case 2: payload[i + 1] = payload[i + 1] ^ maskKey[1];
        case 1: payload[i] = payload[i] ^ maskKey[0];
        case 0:;
    }

    return payload
}


server.listen(8080, 'localhost', function () {
    console.log('listening on localhost:8080');
});
