// server.js - Node.js 프록시 서버
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const convert = require("xml-js");
require("dotenv").config();
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 서울 버스 API 설정
const BUS_API_BASE_URL = "http://ws.bus.go.kr/api/rest";
const SERVICE_KEY = process.env.SEOUL_BUS_API_KEY;

if (!SERVICE_KEY) {
  console.error("❗ SEOUL_BUS_API_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

// 정류소 검색 API (JSON 변환 포함)
app.get("/api/bus/stations", async (req, res) => {
  const { stSrch, format = "xml" } = req.query;
  if (!stSrch) return res.status(400).json({ error: "stSrch 파라미터가 필요합니다." });

  try {
    const response = await axios.get(`${BUS_API_BASE_URL}/stationinfo/getStationByName`, {
      params: { serviceKey: SERVICE_KEY, stSrch },
      timeout: 10000,
    });

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

// 버스 노선 검색 API
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

// 정류소별 버스 노선 조회 API
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

// 정류소 순번(=ord) 구하기 함수
async function getStationSeq(busRouteId, stopId) {
  const url = `${BUS_API_BASE_URL}/busRouteInfo/getStationByRoute`;
  const res = await axios.get(url, {
    params: { serviceKey: SERVICE_KEY, busRouteId },
    timeout: 10000,
  });
  const xmlData = res.data;

  const regex = /<itemList>[\s\S]*?<station>(\d+)<\/station>[\s\S]*?<seq>(\d+)<\/seq>/g;
  let match;
  while ((match = regex.exec(xmlData)) !== null) {
    const [_, station, seq] = match;
    if (station === stopId) return seq;
  }
  throw new Error("정류소 순번(ord) 찾을 수 없음");
}

const savedSettings = [];
const sentAlerts = new Set();

app.post("/api/busAlert", (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "배열 형식으로 설정을 보내주세요." });
  savedSettings.length = 0;
  savedSettings.push(...req.body);
  res.json({ message: "설정 저장 완료" });
});

const { format } = require('date-fns');

async function periodicCheck() {
  const now = new Date();
  const nowTime = format(now, "HH:mm");

  for (const setting of savedSettings) {
    const { stopId, busRouteId, bus, stop, timeRange, alarm } = setting;
    const [startH, startM] = timeRange.start.split(":").map(Number);
    const startTime = new Date(now);
    startTime.setHours(startH, startM, 0, 0);
    const alertStartTime = new Date(startTime.getTime() - parseInt(alarm) * 60000);

    if (nowTime < timeRange.start || nowTime > timeRange.end) continue;
    if (now < alertStartTime) continue;

    let ord;
    try {
      ord = await getStationSeq(busRouteId, stopId);
    } catch (err) {
      console.error("ord 조회 실패:", err.message);
      continue;
    }

    try {
      const arrivalUrl = `${BUS_API_BASE_URL}/arrive/getArrInfoByRoute`;
      const response = await axios.get(arrivalUrl, {
        params: { serviceKey: SERVICE_KEY, stId: stopId, busRouteId, ord },
        timeout: 10000,
      });

      const jsonResult = JSON.parse(convert.xml2json(response.data, { compact: true }));
      const item = jsonResult.ServiceResult?.msgBody?.itemList;

      if (!item) continue;

      const traTime1 = parseInt(item.traTime1?._text || "0");
      const arrmsg1 = item.arrmsg1?._text || "";

      if (!isNaN(traTime1)) {
        const minLeft = Math.round(traTime1 / 60);
        const alertKey = `${busRouteId}-${stopId}-${alarm}-${timeRange.start}-${timeRange.end}`;

        if (minLeft <= parseInt(alarm) && !sentAlerts.has(alertKey)) {
          await axios.post(DISCORD_WEBHOOK, {
            content: `🚌 ${bus}번 버스가 *${stop}* 정류장에 ${alarm}분 뒤 도착 예정이에요! (${arrmsg1})`,
          });
          sentAlerts.add(alertKey);
        }
      }
    } catch (err) {
      console.error("도착 정보 오류:", err.message);
    }
  }
}

setInterval(periodicCheck, 60 * 1000);

app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "서버 정상 작동 중", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "main.html"));
});

app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});

// 에러 핸들링
app.use((error, req, res, next) => {
  console.error("서버 오류:", error);
  res.status(500).json({ error: "서버 내부 오류", message: error.message });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({ error: "404 Not Found", message: `${req.originalUrl} 경로가 없습니다.` });
});
