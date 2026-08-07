const BasePlugin = require('./BasePlugin');

class SmsPlugin extends BasePlugin {
    constructor(eventEmitter) {
        super('SmsPlugin');
        this.emitter = eventEmitter;
        this.threads = new Map(); // thread_id -> { threadId, contactName, address, lastMessage, messages: [] }
    }

    getCapabilities() {
        return ['kdeconnect.sms.messages', 'kdeconnect.sms.request'];
    }

    handlePacket(device, packet) {
        if (packet.type === 'kdeconnect.sms.messages') {
            const body = packet.body || {};
            const rawMessages = body.messages || [];

            console.log(`[SmsPlugin] Received ${rawMessages.length} SMS messages from ${device.info.name}`);

            rawMessages.forEach((msg) => {
                const threadId = msg.thread_id || msg.threadId || (msg.addresses && msg.addresses[0] ? msg.addresses[0].address : 'default');
                const address = (msg.addresses && msg.addresses[0]) ? msg.addresses[0].address : (msg.address || 'Unknown');
                const text = msg.body || '';
                const timestamp = msg.date || Date.now();
                const type = msg.type || 1; // 1 = Received, 2 = Sent

                if (!this.threads.has(threadId)) {
                    this.threads.set(threadId, {
                        threadId: threadId,
                        address: address,
                        contactName: address,
                        lastMessage: text,
                        lastDate: timestamp,
                        messages: []
                    });
                }

                const thread = this.threads.get(threadId);
                thread.lastMessage = text;
                thread.lastDate = Math.max(thread.lastDate, timestamp);

                const msgObj = {
                    id: msg._id || `sms_${timestamp}_${Math.random().toString(36).substr(2, 4)}`,
                    threadId: threadId,
                    address: address,
                    body: text,
                    date: timestamp,
                    type: type // 1: Incoming, 2: Outgoing
                };

                // Avoid duplicates
                if (!thread.messages.some((m) => m.id === msgObj.id || (m.body === msgObj.body && m.date === msgObj.date))) {
                    thread.messages.push(msgObj);
                    thread.messages.sort((a, b) => a.date - b.date);
                }
            });

            if (this.emitter) {
                this.emitter.emit('smsThreadsUpdated', this.getThreadsList());
            }
        }
    }

    sendSms(device, phoneNumber, messageText) {
        if (!device || !phoneNumber || !messageText) return false;

        const smsPacket = {
            id: Date.now(),
            type: 'kdeconnect.sms.request',
            body: {
                sendSms: true,
                phoneNumber: phoneNumber,
                messageBody: messageText
            }
        };

        console.log(`[SmsPlugin] Sending SMS to ${phoneNumber} via ${device.info.name}: "${messageText}"`);
        return device.sendPacket(smsPacket);
    }

    requestAllThreads(device) {
        if (!device) return false;

        const requestPacket = {
            id: Date.now(),
            type: 'kdeconnect.sms.request',
            body: {
                requestConversationTable: true
            }
        };

        return device.sendPacket(requestPacket);
    }

    getThreadsList() {
        const list = Array.from(this.threads.values());
        list.sort((a, b) => b.lastDate - a.lastDate);
        return list;
    }
}

module.exports = SmsPlugin;
