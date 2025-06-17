// server.js - Node.js 프록시 서버
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const convert = require("xml-js");
require("dotenv").config();
const path = require("path");

const app = express();
const PORT = 3000;

// CORS 설정
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // HTML, CSS, JS 파일들을 public 폴더에서 제공

// 서울 버스 API 설정
const BUS_API_BASE_URL = "http://ws.bus.go.kr/api/rest";
const SERVICE_KEY =
  process.env.SEOUL_BUS_API_KEY ||
  "gL51HvWH8ruRGFMHyoSe2QGeIgjqTGr8TJ7BydOyhS6WZ+CtNq3czi5OoSpke58b7a7pZZEVy/rUx7sEhs04bg=="; // .env 파일에서 읽어오기

console.log("현재 서비스키:", SERVICE_KEY);

// 정류소 검색 API + JSON 응답 옵션
app.get("/api/bus/stations", async (req, res) => {
  try {
    const { stSrch, format = "xml" } = req.query;

    if (!stSrch) {
      return res.status(400).json({
        error: "정류소 이름이 필요합니다.",
        message: "stSrch 파라미터를 입력해주세요.",
      });
    }

    console.log(`정류소 검색 요청: ${stSrch} (format: ${format})`);

    const apiUrl = `${BUS_API_BASE_URL}/stationinfo/getStationByName`;
    const response = await axios.get(apiUrl, {
      params: {
        serviceKey: SERVICE_KEY,
        stSrch: stSrch,
      },
      timeout: 10000,
    });

    // format이 json이면 XML을 JSON으로 변환
    if (format === "json") {
      const jsonResult = convert.xml2json(response.data, {
        compact: true,
        spaces: 2,
      });
      res.json(JSON.parse(jsonResult));
    } else {
      // XML 응답을 그대로 클라이언트로 전달
      res.set("Content-Type", "application/xml");
      res.send(response.data);
    }
  } catch (error) {
    console.error("정류소 검색 오류:", error.message);

    // 에러 발생시 더미 데이터 반환 (개발/테스트용)
    const dummyXml = `
<?xml version="1.0" encoding="UTF-8"?>
<ServiceResult>
    <msgHeader>
        <headerCd>0</headerCd>
        <headerMsg>정상적으로 처리되었습니다.</headerMsg>
        <itemCount>3</itemCount>
    </msgHeader>
    <msgBody>
        <itemList>
            <arsId>12345</arsId>
            <stationNm>${req.query.stSrch}역 1번출구</stationNm>
            <stationId>123456789</stationId>
            <posX>127.123456</posX>
            <posY>37.123456</posY>
        </itemList>
        <itemList>
            <arsId>12346</arsId>
            <stationNm>${req.query.stSrch}역 2번출구</stationNm>
            <stationId>123456790</stationId>
            <posX>127.123457</posX>
            <posY>37.123457</posY>
        </itemList>
        <itemList>
            <arsId>12347</arsId>
            <stationNm>${req.query.stSrch}사거리</stationNm>
            <stationId>123456791</stationId>
            <posX>127.123458</posX>
            <posY>37.123458</posY>
        </itemList>
    </msgBody>
</ServiceResult>`;

    if (req.query.format === "json") {
      const jsonResult = convert.xml2json(dummyXml, {
        compact: true,
        spaces: 2,
      });
      res.json(JSON.parse(jsonResult));
    } else {
      res.set("Content-Type", "application/xml");
      res.send(dummyXml);
    }
  }
});

// 버스 노선 검색 API
app.get("/api/bus/routes", async (req, res) => {
  try {
    const { strSrch } = req.query;

    if (!strSrch) {
      return res.status(400).json({
        error: "버스 번호가 필요합니다.",
        message: "strSrch 파라미터를 입력해주세요.",
      });
    }

    console.log(`버스 노선 검색 요청: ${strSrch}`);

    const apiUrl = `${BUS_API_BASE_URL}/busRouteInfo/getBusRouteList`;
    const response = await axios.get(apiUrl, {
      params: {
        serviceKey: SERVICE_KEY,
        strSrch: strSrch,
      },
      timeout: 10000,
    });

    res.set("Content-Type", "application/xml");
    res.send(response.data);
  } catch (error) {
    console.error("버스 노선 검색 오류:", error.message);

    // 에러 발생시 더미 데이터 반환
    const dummyXml = `
<?xml version="1.0" encoding="UTF-8"?>
<ServiceResult>
    <msgHeader>
        <headerCd>0</headerCd>
        <headerMsg>정상적으로 처리되었습니다.</headerMsg>
        <itemCount>2</itemCount>
    </msgHeader>
    <msgBody>
        <itemList>
            <busRouteId>100100001</busRouteId>
            <busRouteNm>${req.query.strSrch}</busRouteNm>
            <routeType>11</routeType>
            <stStationNm>시작정류소</stStationNm>
            <edStationNm>종료정류소</edStationNm>
        </itemList>
        <itemList>
            <busRouteId>100100002</busRouteId>
            <busRouteNm>${req.query.strSrch}번</busRouteNm>
            <routeType>12</routeType>
            <stStationNm>출발지</stStationNm>
            <edStationNm>도착지</edStationNm>
        </itemList>
    </msgBody>
</ServiceResult>`;

    res.set("Content-Type", "application/xml");
    res.send(dummyXml);
  }
});

// 정류소별 버스 노선 조회 API (신규 추가)
app.get("/api/bus/station-routes", async (req, res) => {
  try {
    const { arsId } = req.query;

    if (!arsId) {
      return res.status(400).json({
        error: "정류소 번호가 필요합니다.",
        message: "arsId 파라미터를 입력해주세요.",
      });
    }

    console.log(`정류소별 버스 노선 조회 요청 - 정류소 ID: ${arsId}`);

    const apiUrl = `${BUS_API_BASE_URL}/stationinfo/getRouteByStation`;
    const response = await axios.get(apiUrl, {
      params: {
        serviceKey: SERVICE_KEY,
        arsId: arsId,
      },
      timeout: 10000,
    });

    console.log(`정류소별 버스 노선 조회 응답 상태: ${response.status}`);
    console.log(`정류소 ${arsId}를 지나는 버스 노선 조회 완료`);
    
    // XML 응답을 그대로 전달
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(response.data);

  } catch (error) {
    console.error("정류소별 버스 노선 조회 API 오류:", error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        error: "요청 시간 초과",
        message: "버스 API 서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
      });
    }

    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        error: "정류소를 찾을 수 없습니다.",
        message: "입력한 정류소 번호가 올바르지 않습니다.",
      });
    }

    res.status(500).json({
      error: "정류소별 버스 노선 조회 중 오류가 발생했습니다.",
      message: error.message,
    });
  }
});

// 서버 상태 확인
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "서버가 정상적으로 작동중입니다.",
    timestamp: new Date().toISOString(),
  });
});

// 메인 페이지 제공
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "main.html"));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚌 Oh My 붕붕 서버가 포트 ${PORT}에서 실행중입니다!`);
  console.log(`🌐 브라우저에서 http://localhost:${PORT} 접속하세요`);
  console.log(`📡 API 엔드포인트:`);
  console.log(`   - GET /api/bus/stations?stSrch=정류소명`);
  console.log(`   - GET /api/bus/routes?strSrch=버스번호`);
  console.log(`   - GET /health (서버 상태 확인)`);
  console.log(`\n⚠️  주의사항:`);
  console.log(`   SERVICE_KEY를 실제 인증키로 교체해주세요!`);
  console.log(`   현재는 오류 발생시 더미 데이터를 반환합니다.`);
});

// 에러 핸들링
app.use((error, req, res, next) => {
  console.error("서버 오류:", error);
  res.status(500).json({
    error: "서버 내부 오류가 발생했습니다.",
    message: error.message,
  });
});

// 404 핸들링
app.use((req, res) => {
  res.status(404).json({
    error: "페이지를 찾을 수 없습니다.",
    message: `${req.originalUrl} 경로가 존재하지 않습니다.`,
  });
});
