const { RPCClient } = require('ocpp-rpc');

const cli = new RPCClient({
    endpoint: 'ws://localhost:3000', // the OCPP endpoint URL
    identity: 'EXAMPLE',             // the OCPP identity
    protocols: ['ocpp1.6'],          // client understands ocpp1.6 subprotocol
    strictMode: true,                // enable strict validation of requests & responses
});

cli.on('connected', () => {
    console.log('Connected to the OCPP server');
});

cli.on('BootNotificationResponse', (response) => {
    if (response.status === 'Accepted') {
        console.log('BootNotification accepted by the server');

        const authorizeResponse = cli.call('Authorize', {
            idTag: '23F532C35'
        });

        if (authorizeResponse.idTagInfo.status === 'Accepted') {
            console.log('ID tag authorized successfully');
        } else {
            console.log('ID tag authorization failed');
        }
    } else {
        console.log('BootNotification rejected by the server');
    }
});

cli.on('error', (error) => {
    console.error('Error:', error);
});

cli.connect();