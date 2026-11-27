import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import ConversationTopic from '../models/ConversationTopic.js';
import Vocabulary from '../models/Vocabulary.js';
import Faq from '../models/Faq.js';
import LearningResource from '../models/LearningResource.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getSettings } from '../services/settingsService.js';

const topics = [
  ['self-introduction', 'Self Introduction', '👋', 'Tell your partner who you are.', false, ['What is your name and where are you from?', 'Tell me a little about yourself.', 'What do you do every day?']],
  ['daily-routine', 'Daily Routine', '⏰', 'Talk about a normal day.', false, ['What time do you wake up?', 'What does your morning look like?', 'How do you relax in the evening?']],
  ['family', 'Family', '👨‍👩‍👧', 'Share stories about your family.', false, ['How many people are in your family?', 'Who are you closest to?', 'What do you do together on weekends?']],
  ['education', 'Education', '🎓', 'Schools, studying and learning.', false, ['What did you study?', 'What was your favourite subject?', 'What would you like to learn next?']],
  ['job-career', 'Job and Career', '💼', 'Work life and future goals.', false, ['What do you do for work?', 'What do you like most about your job?', 'Where do you see yourself in five years?']],
  ['hobbies', 'Hobbies', '🎨', 'Things you love to do.', false, ['What are your hobbies?', 'How did you start this hobby?', 'Do you prefer indoor or outdoor activities?']],
  ['food', 'Food', '🍜', 'Favourite dishes and cooking.', false, ['What is your favourite food?', 'Can you cook? What is your best dish?', 'What food from your country should everyone try?']],
  ['travel', 'Travel', '✈️', 'Places you have been and want to go.', false, ['Where did you travel last?', 'What is your dream destination?', 'Do you prefer the beach or the mountains?']],
  ['shopping', 'Shopping', '🛍️', 'Buying things and bargains.', false, ['Do you enjoy shopping?', 'Do you shop online or in stores?', 'What was the last thing you bought?']],
  ['technology', 'Technology', '💻', 'Gadgets, apps and the future.', false, ['What apps do you use every day?', 'How has technology changed your life?', 'Will AI change your job?']],
  ['current-affairs', 'Current Affairs', '📰', 'Talk about what is happening in the world.', true, ['What news story caught your attention recently?', 'How do you usually follow the news?', 'What problem would you like the world to solve first?']],
  ['interview-practice', 'Interview Practice', '🎤', 'Practise common job interview questions.', true, ['Tell me about yourself.', 'What is your greatest strength?', 'Why should we hire you?']],
];

const starters = [
  'How are you today?',
  'Where are you from?',
  'What do you do?',
  'What are your hobbies?',
  'What did you do yesterday?',
  'What is your favorite food?',
  'Why are you learning English?',
];

const phrases = [
  ['Could you please speak slowly?', 'Ask your partner to slow down'],
  ['Can you repeat that?', 'When you did not hear or understand'],
  ['I am learning English.', 'Tell your partner about your goal'],
  ['I am a beginner.', 'Let your partner know your level'],
  ['Please correct my English after I finish speaking.', 'Ask for polite feedback'],
  ['Nice talking to you.', 'A friendly way to end the call'],
];

const words = [
  ['routine', 'A set of things you do regularly', 'My morning routine is simple.', 'elementary', 'daily-routine'],
  ['commute', 'To travel regularly between home and work', 'My commute takes thirty minutes.', 'intermediate', 'daily-routine'],
  ['hometown', 'The town or city where you grew up', 'My hometown is by the sea.', 'beginner', 'self-introduction'],
  ['introduce', 'To tell someone your name or about yourself', 'Let me introduce myself.', 'beginner', 'self-introduction'],
  ['relative', 'A person in your extended family', 'I visit my relatives on holidays.', 'elementary', 'family'],
  ['sibling', 'A brother or sister', 'I have two siblings.', 'intermediate', 'family'],
  ['major', 'The main subject you study at university', 'My major is computer science.', 'intermediate', 'education'],
  ['assignment', 'A piece of work given to a student', 'I finished my assignment last night.', 'elementary', 'education'],
  ['deadline', 'The latest time to finish something', 'We have a deadline on Friday.', 'intermediate', 'job-career'],
  ['colleague', 'A person you work with', 'My colleagues are very kind.', 'intermediate', 'job-career'],
  ['hobby', 'An activity you enjoy in your free time', 'My hobby is photography.', 'beginner', 'hobbies'],
  ['relaxing', 'Making you feel calm and rested', 'Reading is relaxing for me.', 'elementary', 'hobbies'],
  ['delicious', 'Having a very good taste', 'This soup is delicious.', 'beginner', 'food'],
  ['ingredient', 'One of the foods used to make a dish', 'Rice is the main ingredient.', 'intermediate', 'food'],
  ['journey', 'A long trip from one place to another', 'The journey took ten hours.', 'elementary', 'travel'],
  ['itinerary', 'A plan of places to visit on a trip', 'Our itinerary includes three cities.', 'upper_intermediate', 'travel'],
  ['bargain', 'Something you buy for less than its usual price', 'This jacket was a bargain.', 'intermediate', 'shopping'],
  ['receipt', 'A paper that shows what you paid for', 'Keep the receipt in case you return it.', 'elementary', 'shopping'],
  ['device', 'A machine or tool, like a phone', 'I use this device every day.', 'elementary', 'technology'],
  ['innovation', 'A new idea or method', 'Innovation drives the tech industry.', 'upper_intermediate', 'technology'],
  ['headline', 'The title of a news story', 'The headline caught my eye.', 'intermediate', 'current-affairs'],
  ['policy', 'A plan of action agreed by a government or group', 'The new policy helps small businesses.', 'upper_intermediate', 'current-affairs'],
  ['strength', 'A good quality that you have', 'Teamwork is my biggest strength.', 'elementary', 'interview-practice'],
  ['achievement', 'Something good you finished with effort', 'Finishing the course was my greatest achievement.', 'upper_intermediate', 'interview-practice'],
  ['fluent', 'Able to speak a language easily and well', 'I want to become fluent in English.', 'intermediate', null],
  ['pronounce', 'To say a word in the correct way', 'How do you pronounce this word?', 'elementary', null],
  ['confident', 'Sure of your own ability', 'I feel more confident every day.', 'elementary', null],
  ['accent', 'A way of pronouncing a language that shows where you are from', 'I love your accent.', 'intermediate', null],
];

const faqs = [
  ['How does SpeakMate match me with a partner?', 'We pair you with another online learner at a similar English level who wants to practise the same kind of English. If nobody close to your level is online, the search widens gradually so you do not wait long.'],
  ['Is SpeakMate audio only?', 'Yes. SpeakMate only uses your microphone. There is no video, no camera access and no text chat.'],
  ['Are my calls recorded?', 'No. Audio goes directly between you and your partner (peer to peer). We never record calls and admins cannot listen to them. We only keep metadata such as the call length.'],
  ['Does my partner see my phone number or email?', 'Never. Partners only see your display name, profile picture, English level and (optionally) your country.'],
  ['What if my partner is rude?', 'End the call at any time, then report and block the person from the call summary screen. Our moderators review every report.'],
  ['The microphone does not work. What should I do?', 'Allow microphone access in your browser address bar, check that no other app is using the microphone and try again. On iPhone use Safari or the installed app.'],
  ['Can I use SpeakMate without an account?', 'Yes, you can practise as a guest. Create a free account to save your history, streak, favorites and settings.'],
];

const resources = [
  ['BBC Learning English', 'Free lessons, podcasts and videos for every level.', 'https://www.bbc.co.uk/learningenglish', 'Lessons'],
  ['British Council LearnEnglish', 'Grammar, vocabulary and listening practice.', 'https://learnenglish.britishcouncil.org', 'Grammar'],
  ['Cambridge Dictionary', 'Look up meanings and listen to pronunciation.', 'https://dictionary.cambridge.org', 'Dictionary'],
  ['VOA Learning English', 'Slow-paced news stories for learners.', 'https://learningenglish.voanews.com', 'Listening'],
];

export async function ensureSeed() {
  await getSettings(); // creates default settings

  if (!(await ConversationTopic.countDocuments())) {
    await ConversationTopic.insertMany(
      topics.map(([slug, title, icon, description, premium, s], i) => ({ slug, title, icon, description, premium, starters: s, order: i }))
    );
    logger.info('Seeded conversation topics');
  }

  if (!(await Vocabulary.countDocuments())) {
    await Vocabulary.insertMany([
      ...starters.map((word) => ({ kind: 'starter', word })),
      ...phrases.map(([word, meaning]) => ({ kind: 'phrase', word, meaning })),
      ...words.map(([word, meaning, example, level, topicSlug]) => ({ kind: 'word', word, meaning, example, level, topicSlug })),
    ]);
    logger.info('Seeded vocabulary');
  }

  if (!(await Faq.countDocuments())) {
    await Faq.insertMany(faqs.map(([question, answer], i) => ({ question, answer, order: i })));
  }
  if (!(await LearningResource.countDocuments())) {
    await LearningResource.insertMany(resources.map(([title, description, url, category], i) => ({ title, description, url, category, order: i })));
  }

  if (!(await Admin.countDocuments())) {
    const { email, password, name } = env.seedAdmin;
    if (!password) {
      logger.warn('No admin exists. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD, then restart to create the Super Admin.');
    } else {
      await Admin.create({ email, name, role: 'super_admin', passwordHash: await bcrypt.hash(password, 12) });
      logger.info(`Super Admin created: ${email}${env.isProd ? '' : ` (dev password: ${password})`}`);
    }
  }
}
