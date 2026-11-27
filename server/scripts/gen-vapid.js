// Prints a fresh VAPID key pair for Web Push. Copy the values into server/.env
import * as webpush from 'web-push';
const keys = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
