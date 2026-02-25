/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const Redis = require('ioredis');

/**
 * HeadyBuddy Voice Relay
 * Captures Web Speech API text from mobile and routes it directly 
 * into the desktop IDE/Mini-PC via WebSockets and Redis PubSub.
 */
class VoiceRelay {
    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        this.sub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    }

    async transmitDictation(userId, payloadText) {
        const packet = {
            user: userId,
            timestamp: Date.now(),
            text: payloadText
        };
        await this.redis.publish(`voice_relay:${userId}`, JSON.stringify(packet));
        console.log(`🎙️ [Voice Relay] Transmitted ${payloadText.length} chars from mobile to desktop.`);
    }

    listenForDesktop(userId, uiCallback) {
        this.sub.subscribe(`voice_relay:${userId}`);
        this.sub.on('message', (channel, message) => {
            const data = JSON.parse(message);
            console.log(`💻 [Desktop Receive] Dictation arrived: "${data.text.substring(0, 20)}..."`);
            uiCallback(data.text);
        });
    }
}

module.exports = new VoiceRelay();
