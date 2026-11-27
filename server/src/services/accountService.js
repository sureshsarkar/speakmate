import FavoritePartner from '../models/FavoritePartner.js';
import Connection from '../models/Connection.js';
import Notification from '../models/Notification.js';
import BlockedUser from '../models/BlockedUser.js';
import Subscription from '../models/Subscription.js';
import PracticeHistory from '../models/PracticeHistory.js';
import { hub } from './matchHub.js';

/**
 * Removes a registered user and their personal data.
 * Anonymous call metadata (CallSession) is kept for abuse investigations.
 */
export async function deleteUserCascade(user) {
  const pid = user.publicId;
  await Promise.all([
    FavoritePartner.deleteMany({ $or: [{ ownerPublicId: pid }, { partnerPublicId: pid }] }),
    Connection.deleteMany({ $or: [{ requester: pid }, { recipient: pid }] }),
    Notification.deleteMany({ recipientPublicId: pid }),
    BlockedUser.deleteMany({ blockerPublicId: pid }),
    Subscription.deleteMany({ user: user._id }),
    PracticeHistory.deleteMany({ ownerPublicId: pid }),
  ]);
  await user.deleteOne();
  hub.forceOffline(pid, 'deleted');
}
