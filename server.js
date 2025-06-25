const express = require("express"); // 서버 만들 때 씀
const cors = require("cors"); // 다른 곳에서 요청해도 허용해주는 도구
const axios = require("axios");
const convert = require("xml-js"); // XML → JSON
require("dotenv").config();
const path = require("path"); // 파일 경로를 쉽게 관리하기 위해

const app = express(); // 익스프레스 앱(서버) 만들기
const PORT = 3000;

// 미들웨어 설정
app.use(cors()); // 모든 외부 요청 허용
app.use(express.json()); // JSON 형식 요청을 이해할 수 있게 함
app.use(express.static("public")); // public 폴더 안에 있는 파일을 웹에서 볼 수 있게 함

// 서울 버스 API 기본 주소랑 키 설정
const BUS_API_BASE_URL = "http://ws.bus.go.kr/api/rest";
const SERVICE_KEY = process.env.SEOUL_BUS_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

// API 키가 없으면 오류 메시지 출력하고 서버 종료
if (!SERVICE_KEY) {
  console.error("SEOUL_BUS_API_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

// 정류소 이름으로 검색하는 API
app.get("/api/bus/stations", async (req, res) => {
  const { stSrch, format = "xml" } = req.query; // 사용자가 보낸 검색어 가져오기
  if (!stSrch) return res.status(400).json({ error: "stSrch 파라미터가 필요합니다." });

  try {
    // 서울 버스 API에 요청 보내기
    const response = await axios.get(`${BUS_API_BASE_URL}/stationinfo/getStationByName`, {
      params: { serviceKey: SERVICE_KEY, stSrch },
      timeout: 10000,
    });

    // JSON으로 변환 요청이면 변환해서 보내줌
    if (format === "json") {
      const jsonResult = convert.xml2json(response.data, { compact: true, spaces: 2 });
      res.json(JSON.parse(jsonResult));
    } else {
      res.type("application/xml").send(response.data);
    }
  } catch (error) {
    res.status(500).json({ error: "정류소 검색 API 호출 중 오류 발생", message: error.message });
  }
});

// 버스 번호로 노선 검색하는 API
app.get("/api/bus/routes", async (req, res) => {
  const { strSrch } = req.query;
  if (!strSrch) return res.status(400).json({ error: "strSrch 파라미터가 필요합니다." });

  try {
    const response = await axios.get(`${BUS_API_BASE_URL}/busRouteInfo/getBusRouteList`, {
      params: { serviceKey: SERVICE_KEY, strSrch },
      timeout: 10000,
    });
    res.type("application/xml").send(response.data);
  } catch (error) {
    res.status(500).json({ error: "버스 노선 검색 API 호출 중 오류 발생", message: error.message });
  }
});

// 정류장 ID로 해당 정류장에 오는 버스들 조회
app.get("/api/bus/station-routes", async (req, res) => {
  const { arsId } = req.query;
  if (!arsId) return res.status(400).json({ error: "arsId 파라미터가 필요합니다." });

  try {
    const response = await axios.get(`${BUS_API_BASE_URL}/stationinfo/getRouteByStation`, {
      params: { serviceKey: SERVICE_KEY, arsId },
      timeout: 10000,
    });
    res.type("application/xml; charset=utf-8").send(response.data);
  } catch (error) {
    res.status(500).json({ error: "정류소별 버스 노선 조회 API 호출 중 오류 발생", message: error.message });
  }
});

// 사용자 설정 저장
const savedSettings = []; // 설정 저장 배열
const sentAlerts = new Set(); // 이미 알림 보낸 것 저장

// 설정 저장 API (로컬에서 받아옴)
app.post("/api/busAlert", (req, res) => {
  console.log("[POST] /api/busAlert 호출됨");
  console.log("받은 설정:", JSON.stringify(req.body, null, 2));  // 서버에 저장되는지 확인

  if (!Array.isArray(req.body)) return res.status(400).json({ error: "배열 형식으로 설정을 보내주세요." });
  savedSettings.length = 0; // 기존 설정 비우고
  savedSettings.push(...req.body); // 새로 저장
  res.json({ message: "설정 저장 완료" });
});

const { format } = require('date-fns'); // 시간 포맷팅용

// 1분마다 알림 보낼지 확인하는 함수
async function periodicCheck() {
  const now = new Date();
  const nowTime = format(now, "HH:mm");
  const today = format(now, "yyyy-MM-dd");
  console.log("periodicCheck 실행:", nowTime);

  // 저장된 설정 배열 순회
  for (const setting of savedSettings) {
    const { stopId, busRouteId, bus, stop, timeRange, alarm } = setting;

    // 현재 시간이 설정된 시간 범위 안에 있는지 확인
    if (nowTime < timeRange.start || nowTime > timeRange.end) {
      console.log("시간대 아님 :", timeRange.start, "~", timeRange.end);
      continue; // 시간 범위 밖이면 다음으로
    }

    // 알림 시작 기준 시간 계산
    const [startH, startM] = timeRange.start.split(":").map(Number);
    const startTime = new Date(now);
    startTime.setHours(startH, startM, 0, 0);
    const alertStartTime = new Date(startTime.getTime() - parseInt(alarm) * 60000);

    // 현재 시간이 알림 시작 시간보다 전이면 건너뜀
    if (now < alertStartTime) {
      console.log("알림 시간 전 :", alarm, "분 전 기준");
      continue;
    }

    try {
      // 버스 도착 정보 API 호출
      const url = `${BUS_API_BASE_URL}/arrive/getArrInfoByRouteAll`;
      const response = await axios.get(url, {
        params: {
          serviceKey: SERVICE_KEY,
          busRouteId
        },
        timeout: 10000,
      });

      const json = JSON.parse(convert.xml2json(response.data, { compact: true }));
      const items = json?.ServiceResult?.msgBody?.itemList;

      if (!items) {
        console.log("도착 정보 없음");
        continue;
      }

      const itemArr = Array.isArray(items) ? items : [items];

      // 해당 정류소에 대한 도착 정보 찾기
      const matchedStop = itemArr.find(item => item.stId?._text === stopId);

      if (!matchedStop) {
        console.log("정류소 정보 못 찾음:", stopId);
        continue;
      }

      // 남은 도착 시간
      const traTime1 = parseInt(matchedStop.traTime1?._text || "0");
      const arrmsg1 = matchedStop.arrmsg1?._text || "";
      const minLeft = Math.round(traTime1 / 60);

      // 알림 전송 중복 방지를 위한 고유 키
      const alertKey = `${today}-${busRouteId}-${stopId}-${alarm}-${timeRange.start}-${timeRange.end}`;

      console.log(`${stop} 정류장 ${bus}번 → ${minLeft}분 남음 / 조건 : ${alarm}분 전`);

      // 도착 시간이 설정한 알림 시간 이내이고 아직 전송하지 않은 경우
      if (!isNaN(minLeft) && minLeft <= parseInt(alarm) && !sentAlerts.has(alertKey)) {
        await axios.post(DISCORD_WEBHOOK, {
          content: `🚌 ${bus}번 버스가 ${stop} 정류장에 ${alarm}분 뒤 도착 예정이에요! (${arrmsg1})`,
        });
        sentAlerts.add(alertKey);
        console.log("✅ 디스코드 전송 완료:", alertKey);
      } else {
        console.log("조건 미충족 또는 이미 전송됨");
      }
    } catch (err) {
      console.error("도착 정보 오류:", err.message);
    }
  }
}

// 1분마다 체크하기
setInterval(periodicCheck, 60 * 1000);

// 서버 상태 확인 API
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "서버 정상 작동 중", timestamp: new Date().toISOString() });
});

// 기본 페이지 (사용자 설정창) 열기
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "main.html"));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  axios.post(DISCORD_WEBHOOK, {
    content: `🚌 Oh My 붕붕이 실행 중입니다!`,
  });
});

// 에러 처리
app.use((error, req, res, next) => {
  console.error("서버 오류:", error);
  res.status(500).json({ error: "서버 내부 오류", message: error.message });
});

// 404 처리
app.use((req, res) => {
  res.status(404).json({ error: "404 Not Found", message: `${req.originalUrl} 경로가 없습니다.` });
});
