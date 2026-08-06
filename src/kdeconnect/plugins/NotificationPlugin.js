const BasePlugin = require('./BasePlugin');

class NotificationPlugin extends BasePlugin {
    constructor(eventEmitter) {
        super('NotificationPlugin');
        this.emitter = eventEmitter;
        this.notifications = new Map(); // id -> notification object
    }

    getCapabilities() {
        return ['kdeconnect.notification', 'kdeconnect.notification.request'];
    }

    handlePacket(device, packet) {
        if (packet.type === 'kdeconnect.notification') {
            const body = packet.body || {};

            if (body.isCancel) {
                // Notification dismissed on phone
                this.notifications.delete(body.id);
                if (this.emitter) {
                    this.emitter.emit('notificationDismissed', { id: body.id, deviceId: device.info.id });
                }
                return;
            }

            const notifData = {
                id: body.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                deviceId: device.info.id,
                appName: body.appName || 'Android App',
                title: body.title || 'Notification',
                text: body.text || body.ticker || '',
                ticker: body.ticker || '',
                time: Date.now(),
                requestReplyId: body.requestReplyId || null,
                isClearable: body.isClearable !== false,
                silent: body.silent || false
            };

            this.notifications.set(notifData.id, notifData);

            if (this.emitter) {
                this.emitter.emit('notificationReceived', notifData);
            }
        }
    }

    replyToNotification(device, requestReplyId, replyText) {
        if (!device || !requestReplyId || !replyText) return false;

        const replyPacket = {
            id: Date.now(),
            type: 'kdeconnect.notification.reply',
            body: {
                requestReplyId: requestReplyId,
                message: replyText
            }
        };

        console.log(`[NotificationPlugin] Sending inline reply to ${device.info.name}: "${replyText}"`);
        return device.sendPacket(replyPacket);
    }

    dismissNotification(device, notificationId) {
        if (!device || !notificationId) return false;

        const dismissPacket = {
            id: Date.now(),
            type: 'kdeconnect.notification',
            body: {
                id: notificationId,
                isCancel: true
            }
        };

        this.notifications.delete(notificationId);
        console.log(`[NotificationPlugin] Dismissing notification ${notificationId} on ${device.info.name}`);
        return device.sendPacket(dismissPacket);
    }

    requestAllNotifications(device) {
        if (!device) return false;

        const requestPacket = {
            id: Date.now(),
            type: 'kdeconnect.notification.request',
            body: { request: true }
        };

        return device.sendPacket(requestPacket);
    }

    getNotifications() {
        return Array.from(this.notifications.values());
    }
}

module.exports = NotificationPlugin;
