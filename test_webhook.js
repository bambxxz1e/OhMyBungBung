require('dotenv').config();

const axios = require('axios');
const webhookURL = process.env.WEBHOOK_URL;

const message = {
  content: '🚌 버스 알림 테스트입니다! 잘 도착하고 있어요!'
};

axios.post(webhookURL, message)
  .then(() => {
    console.log('✅ 메시지 전송 성공!');
  })
  .catch((err) => {
    console.error('❌ 메시지 전송 실패:', err);
  });
