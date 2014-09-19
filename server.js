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

    // stream ���f�[�^�̒f�Ђ�ǂݎ��\�ɂȂ������ɔ���
    stream.on('readable', function () {
        res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'text-plain' });
    });

    // �f�[�^�̓ǂݍ��݂���������^�C�~���O�ŃR�[���o�b�N�֐��ɓn�����
    stream.on('data', function (chunk) {
        res.write(chunk);
    });

    // �f�[�^�����S�ɓǂݍ��ݏI��������ɔ���
    stream.on('end', function () {
    });

    // �t�@�C�����N���[�Y���ꂽ���ɔ���
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
    // url���W���[�����g���ĕ�������
    var pathName = url.parse(req.url).pathname;
    var filePath = __dirname + pathName;

    if (req.method != 'GET') {
        responseError(res, 500);
        return;
    }

    // �t�@�C���̏��擾
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


// �N���C�A���g����HTTP/1.1��Upgrade���N�G�X�g��M���ɔ���
server.on('upgrade', function (req, socket, head) {
    var key = req.headers['sec-websocket-key'];
    var connectValue = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    // [Sec-WebSocket-Accept]�t�B�[���h�̒l�̋��ߕ�
    // Sec-WebSocket-Key(key) �̖����̋󔒂�`�����l������
    // key �ɌŒ�l "258EAFA5-E914-47DA-95CA-C5AB0DC85B11" ��A��
    // sha1 ���擾
    // base64 �ɕϊ�
    var acceptValue = require('crypto').createHash('sha1').update(key + connectValue).digest('base64');

    // ���X�|���X�w�b�_(HTTP�̋K��Ńw�b�_�ƃ{�f�B�̋�؂�q�ɋ�s������)
    var responseHeader = 'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + acceptValue + '\r\n' +
        'Sec-WebSocket-Protocol: chat\r\n' +
        '\r\n';

    // WebSocket�ւ̃A�b�v�O���[�h�ɑ΂��Ẵ��X�|���X
    socket.write(responseHeader);

    // �N���C�A���g send���\�b�h�ɂ�蔭��(�o�C�i���`���̃f�[�^�t���[���ł����)
    socket.on('data', function (frame) {
        console.log('');
        console.log('--- frame ---');
        console.log(frame);
        console.log('');


        console.log('--- 1byte ---');
        var firstByte = frame[0];

        // [1byte] 1bit
        console.log('Fin[1] : ' + (firstByte & 0x80).toString(2));

        // [1byte] 1bit�Â�
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

        // [2byte] 7, 7+16, 7+64 bit�̂����ꂩ
        var payloadLength = secondByte & 0x7F;
        console.log('PayloadLength[7] : ' + payloadLength + 'byte');

        // Payload�� 0-125 �̂ݑΉ�
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
        // [7byte ~ �Ō�܂�] PayloadData
        var payload = frame.slice(6, frame.length);
        console.log('Payload[' + (payloadLength * 8) + '] :');
        console.log(payload);

        var unmaskedPayload = unmask(maskKey, payloadLength, payload);
        // unmask����Payload
        console.log('UnmaskedPayload : ');
        console.log(unmaskedPayload);
        console.log(unmaskedPayload.toString());
        console.log('');


        console.log('--- send data to cliant ---');
        // �N���C�A���g�ɑ��M����t���[��
        // 1byte: FIN, RSV1-3, OPCODE
        // 2byte: MASK, Payload��
        // 3byte�ȍ~: PayloadData(unmasked)
        var sendFrame = new Buffer(2 + payloadLength);

        sendFrame[0] = firstByte;
        sendFrame[1] = payloadLength;
        for (var i = 0; i < payloadLength; i++) {
            sendFrame[i + 2] = unmaskedPayload[i];
        }
        console.log(sendFrame);

        // �N���C�A���g�ɑ��M
        socket.end(sendFrame);
    })
});

// �}�X�N���ꂽ�y�C���[�h���A���}�X�N���ĕԋp
function unmask(maskKey, payloadLength, payload) {
    // 4byte�Â���
    var maskNum = maskKey.readUInt32BE(0, true);
    var i = 0;
    for (; i < payloadLength - 3; i += 4) {
        var single = maskNum ^ payload.readUInt32BE(i, true);
        if (single < 0) single = 4294967296 + single;
        payload.writeUInt32BE(single, i, true);
    }

    // �]�������
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
