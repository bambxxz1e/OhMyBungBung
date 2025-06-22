// 사용자 설정 저장
function saveInfo() {
    if (!selectedStopInfo.name || !selectedStopInfo.id) {
        alert("정류소를 선택해주세요.");
        return;
    }
    if (!selectedBusInfo.number || !selectedBusInfo.routeId) {
        alert("버스 노선을 선택해주세요.");
        return;
    }

    const startTime = document.querySelector("#start").value;
    const endTime = document.querySelector("#end").value;
    const alarmTime = document.querySelector("select[name='alarm']").value;

    if (!startTime || !endTime) {
        alert("시간대를 설정해주세요.");
        return;
    }

    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    if (endTotal < startTotal) {
        alert("끝나는 시간은 시작 시간보다 늦어야 합니다.");
        return;
    }
    if (endTotal - startTotal > 30) {
        alert("시간대는 최대 30분까지만 설정할 수 있습니다.");
        return;
    }

    const formData = {
        stop: selectedStopInfo.name,
        stopId: selectedStopInfo.id,
        arsId: selectedStopInfo.arsId,
        bus: selectedBusInfo.number,
        busRouteId: selectedBusInfo.routeId,
        routeType: selectedBusInfo.routeType,
        timeRange: {
            start: startTime,
            end: endTime,
        },
        alarm: alarmTime,
    };

    // 중복 방지
    const existing = JSON.parse(localStorage.getItem("userBusDataList") || "[]");
    const isDuplicate = existing.some(item =>
        item.stopId === formData.stopId &&
        item.busRouteId === formData.busRouteId &&
        item.timeRange.start === formData.timeRange.start &&
        item.timeRange.end === formData.timeRange.end &&
        item.alarm === formData.alarm
    );

    if (isDuplicate) {
        alert("이미 동일한 알림이 저장되어 있습니다.");
        return;
    }

    existing.push(formData);
    localStorage.setItem("userBusDataList", JSON.stringify(existing));
    alert("🚨알림이 저장되었습니다!");

    // 서버에 최신 목록 전송
    fetch("http://localhost:3000/api/busAlert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existing),
    })
    .then(res => res.json())
    .then(data => console.log("서버 응답:", data))
    .catch(err => console.error("에러:", err));

    // ⬇️ 저장 후 UI 초기화
    document.querySelector("#start").value = "";
    document.querySelector("#end").value = "";
    selectedStopInfo = {};
    selectedBusInfo = {};
}

// 페이지 버튼 클릭 시 내용 변경
let currentPage = 1;

function changePage(pageNum) {
    currentPage = pageNum;

    // 버튼 스타일 업데이트
    document.querySelectorAll(".page-btn").forEach((btn, i) => {
        btn.classList.toggle("active", i === pageNum - 1);
    });

    // 페이지 보이기/숨기기
    document.getElementById("page1").style.display = pageNum === 1 ? "block" : "none";
    document.getElementById("page2").style.display = pageNum === 2 ? "block" : "none";

    // 제목 변경
    const title = document.getElementById("title");
    title.innerText = pageNum === 1 ? "🚌 버스 알림 설정하기 🚌" : "📋 저장된 버스 알림 보기 📋";

    // 2페이지일 경우 알림 목록 로딩
    if (pageNum === 2) {
        loadSavedList();
    }
}

// 저장된 사용자 설정 불러오기
function loadSavedList() {
    const data = JSON.parse(localStorage.getItem("userBusDataList") || "[]");
    const listDiv = document.getElementById("savedList");

    if (data.length === 0) {
        listDiv.innerText = "저장된 알림이 없습니다.";
        return;
    }

    listDiv.innerHTML = data.map((item, idx) => `
        <div class="alarm-card">
            <button class="delete-btn" onclick="deleteAlarm(${idx})">X</button>
            <strong>${idx + 1}번째 알림</strong>
            <p>정류소 : ${item.stop} (${item.arsId})</p>
            <p>버스 번호 : ${item.bus}</p>
            <p>시간대 : ${item.timeRange.start} ~ ${item.timeRange.end}</p>
            <p>알림 : ${item.alarm}분 전</p>
        </div>
        <hr>
    `).join("");
}

// 설정 삭제하기
function deleteAlarm(idx) {
    const existing = JSON.parse(localStorage.getItem("userBusDataList") || "[]");
    if (existing.length > idx) {
        existing.splice(idx, 1);
        localStorage.setItem("userBusDataList", JSON.stringify(existing));
        alert("알림이 삭제되었습니다!");
        loadSavedList(); // 다시 목록 불러오기

        // 삭제 후 서버에 최신 목록 전송
        fetch('http://localhost:3000/api/busAlert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existing)
        })
        .then(res => res.json())
        .then(data => console.log('서버 응답:', data))
        .catch(err => console.error('에러:', err));
    } else {
        alert("삭제할 알림을 찾을 수 없습니다.");
    }
}
