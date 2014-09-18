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
    socket.on('data', function (buf) {
        // Bufferクラスはバイナリデータをオクテットストリームで扱う。16進数で格納
        console.log(buf);
        console.log('FrameSize ' + buf.length + 'byte');
        console.log('');


        console.log('--- 1byte ---');
        var firstByte = buf[0];

        // FIN : 最後のパケットなら 1, 続くなら 0
        // 1byte目の最初の1bit
        console.log('Fin[1] : ' + (firstByte & 0x80).toString(2));

        // RSV1 ~ 3 予約済みビット
        // 続く1bitづつ
        console.log('Rsv1[1] : ' + (firstByte & 0x40).toString(2));
        console.log('Rsv2[1] : ' + (firstByte & 0x20).toString(2));
        console.log('Rsv3[1] : ' + (firstByte & 0x10).toString(2));

        // opode : PayloadDataの説明
        // %x0  :continuation frame
        // %x1  :text frame
        // %x2  :binary frame
        // %x3-7:reserved for further
        // %x8  :connection close
        // %x9  :ping
        // %xA  :pong
        // %xB-F:reserved for further
        // 続く4bit
        var opcode = firstByte & 0x0F;
        console.log('Opcode[4] : ' + opcode.toString(2));
        console.log('-------------');
        console.log('');


        console.log('--- 2byte --- ');
        var secondByte = buf[1];

        // MASK : 1 ならPayload Data がマスクされている。されていなければ 0。Payload はブラウザが送るときは "必ずマスクする" サーバが送るときは "絶対にマスクしない"
        // 2byte目の最初の1bit
        console.log('Mask[1] : ' + (secondByte & 0x80).toString(2));

        // PayLoad 長
        // 0-125:そのままそれが Payload の長さ
        // 126  :それより長いから、後続の 16bit が UInt16 として Payload の長さを表す
        // 127  :それよりも長いから、後続の 64bit が UInt64 として Payload の長さを表す
        // 続く7, 7+16, 7+64 bitのいずれか
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
        // Masking-key
        // MASK=1 だった場合は必ず付与される、後で Payload を複合するのに使う。
        // 3byte ~ 6byte の32bit
        var maskBuf = buf.slice(2, 6);
        console.log('MaskKey[32] : ');
        console.log(maskBuf);
        console.log('');


        console.log('--- 7byte ~ end ---');
        // PayloadData
        // 7byte ~ 最後までがPayloadDataとなる
        var payload = buf.slice(6, buf.length);
        console.log('Payload : ');
        console.log(payload);

        var maskNum = maskBuf.readUInt32BE(0, true);
        var i = 0;
        for (; i < payloadLength - 3; i += 4) {
            var single = maskNum ^ payload.readUInt32BE(i, true);
            if (single < 0) single = 4294967296 + single;
            payload.writeUInt32BE(single, i, true);
        }

        switch (payloadLength % 4) {
            case 3: payload[i + 2] = payload[i + 2] ^ maskBuf[2];
            case 2: payload[i + 1] = payload[i + 1] ^ maskBuf[1];
            case 1: payload[i] = payload[i] ^ maskBuf[0];
            case 0:;
        }

        // Masking-Keyでunmaskした値
        console.log('UnmaskedPayload : ');
        console.log(payload);
        console.log(payload.toString());
    })
});

server.on('data', function (chunk) {
    console.log(chunk);
})

server.listen(8080, 'localhost', function () {
    console.log('listening on localhost:8080');
});
