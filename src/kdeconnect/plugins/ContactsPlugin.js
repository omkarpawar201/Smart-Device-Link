const BasePlugin = require('./BasePlugin');

class ContactsPlugin extends BasePlugin {
    constructor(eventEmitter) {
        super('ContactsPlugin');
        this.emitter = eventEmitter;
        this.contactsMap = new Map(); // uid -> { name, number, numbers: [], avatar: null }
    }

    getCapabilities() {
        return ['kdeconnect.contacts', 'kdeconnect.contacts.request'];
    }

    handlePacket(device, packet) {
        if (packet.type === 'kdeconnect.contacts') {
            const body = packet.body || {};
            const rawList = body.contacts || body.uids || [];

            console.log(`[ContactsPlugin] Received ${rawList.length} contacts from ${device.info.name}`);

            rawList.forEach((c) => {
                const name = c.name || c.displayName || 'Unknown Contact';
                const numbers = (c.phoneNumbers || c.numbers || []).map((n) => (typeof n === 'string' ? n : n.number || ''));
                const primaryNumber = numbers[0] || c.number || '';
                const uid = c.uid || c.id || primaryNumber || name;

                if (primaryNumber) {
                    this.contactsMap.set(uid, {
                        id: uid,
                        name: name,
                        number: primaryNumber,
                        numbers: numbers,
                        avatar: c.avatar || null
                    });
                }
            });

            if (this.emitter) {
                this.emitter.emit('contactsUpdated', this.getContactsList());
            }
        }
    }

    requestAllContacts(device) {
        if (!device) return false;

        const requestPacket = {
            id: Date.now(),
            type: 'kdeconnect.contacts.request',
            body: {
                requestAll: true
            }
        };

        console.log(`[ContactsPlugin] Requesting full contact list from ${device.info.name}`);
        return device.sendPacket(requestPacket);
    }

    resolveContactName(phoneNumber) {
        if (!phoneNumber) return 'Unknown Caller';
        const cleanQuery = phoneNumber.replace(/\D/g, '');

        for (const contact of this.contactsMap.values()) {
            for (const num of contact.numbers) {
                if (num.replace(/\D/g, '').endsWith(cleanQuery) || cleanQuery.endsWith(num.replace(/\D/g, ''))) {
                    return contact.name;
                }
            }
        }
        return phoneNumber;
    }

    getContactsList() {
        const list = Array.from(this.contactsMap.values());
        list.sort((a, b) => a.name.localeCompare(b.name));
        return list;
    }
}

module.exports = ContactsPlugin;
