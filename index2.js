const { RPCServer, createRPCError } = require('ocpp-rpc');

const server = new RPCServer({
    protocols: ['ocpp1.6'], // server accepts ocpp1.6 subprotocol
    strictMode: true,       // enable strict validation of requests & responses
});

server.auth((accept, reject, handshake) => {
    // accept the incoming client
    accept({
        // anything passed to accept() will be attached as a 'session' property of the client.
        sessionId: 'XYZ123'
    });
});

server.on('client', async (client) => {
    console.log(`${client.session.sessionId} connected!`); // `XYZ123 connected!`

    // create a specific handler for handling BootNotification requests

    client.handle('BootNotification', ({params}) => {
        console.log(`Server got BootNotification from ${client.identity}:`, params);

        // respond to accept the client
        return {
            status: "Accepted",
            interval: 300,
            currentTime: new Date().toISOString()
        };
    });

/*
client.handle('BootNotification', async ({ params }) => {
    console.log(`Server got BootNotification from ${client.identity}:`, params);

    // Respond to accept the client
    const response = {
        status: "Accepted",
        interval: 300,
        currentTime: new Date().toISOString()
    };

    // Attempt to configure MeterValueSampleInterval to 1000 milliseconds (1 second) after accepting BootNotification
    try {
        const configResponse = await client.call('ChangeConfiguration', {
            key: 'MeterValueSampleInterval',
            value: '20'
        });
        console.log('Configuration response:', configResponse);
        if (configResponse.status !== 'Accepted') {
            console.error('Failed to configure MeterValueSampleInterval. Response status:', configResponse.status);
        }
    } catch (error) {
        console.error('Failed to configure MeterValueSampleInterval:', error);
    }

    return response;
});
 */   
    // create a specific handler for handling Heartbeat requests
    client.handle('Heartbeat', ({params}) => {
        console.log(`Server got Heartbeat from ${client.identity}:`, params);

        // respond with the server's current time.
        return {
            currentTime: new Date().toISOString()
        };
    });
    
    // create a specific handler for handling StatusNotification requests
    client.handle('StatusNotification', ({params}) => {
        console.log(`Server got StatusNotification from ${client.identity}:`, params);
        return {};
    });

    client.handle('Authorize', ({params}) => {
        console.log(`Server got Authorize from ${client.identity}:`, params);

        const { idTag } = params;

        if (idTag === 'B4A63CDF' || idTag === '23F532C35' || idTag === '829FEAB') {
            return {
                idTagInfo: {
                    status: 'Accepted'
                }
            };
        } else {
            return {
                idTagInfo: {
                    status: 'Invalid'
                }
            };
        }
    });

        client.handle('StartTransaction', ({ params }) => {
            console.log(`Server got StartTransaction from ${client.identity}:`, params);
    
            const { idTag, meterStart, timestamp, connectorId } = params;

            const transactionId = Math.floor(Math.random() * 100000);
    
            return {
                idTagInfo: {
                    status: 'Accepted'
                },
                transactionId: transactionId
            };
        });

        client.handle('MeterValues', ({ params }) => {
            console.log(`Server got MeterValues from ${client.identity}:`, params);
    
            const { connectorId, transactionId, meterValue } = params;

            meterValue.forEach(value => {
                console.log(`Meter Value: ${JSON.stringify(value)}`);
            });
    
            return {};
        });

        /*
        client.handle('MeterValues', ({ params }) => {
            console.log(`Server got MeterValues from ${client.identity}:`, params);
    
            const { connectorId, transactionId, meterValue } = params;
    
            // Process meter values
            meterValue.forEach(value => {
                console.log(`Meter Value: ${JSON.stringify(value)}`);
    
                // Check if power exceeds threshold (e.g., 7 kW)
                if (!chargingStopped && value.value > 7) {
                    console.log(`Power threshold exceeded. Stopping charging.`);
                    chargingStopped = true;
                    // Send StopTransaction to stop charging
                    client.call('StopTransaction', {
                        transactionId: transactionId,
                        idTag: "stopCharge",
                        timestamp: new Date().toISOString(),
                        meterStop: value.value,
                        reason: "TimeLimitReached" // You can specify your own reason
                    }).then(response => {
                        console.log(`StopTransaction response:`, response);
                    }).catch(error => {
                        console.error(`Failed to send StopTransaction:`, error);
                    });
                }
            });
    
            return {}; // Respond with an empty object to acknowledge receipt
        });
*/
    client.handle(({method, params}) => {
        console.log(`Server got ${method} from ${client.identity}:`, params);
        throw createRPCError("NotImplemented");
    });
});

server.listen(3000);