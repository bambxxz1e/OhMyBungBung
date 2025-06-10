// 사용자 설정 저장
function saveInfo() {
    const formData = {
        // input, select 값 객체로 저장하기
        stop: document.querySelector("#searchStop").value,
        bus: document.querySelector("#searchBus").value,
        timeRange: {
            start: document.querySelector("#start").value,
            end: document.querySelector("#end").value,
        },
        alarm: document.querySelector("select[name ='alarm']").value,
    };

    // 알람 여러 개 저장되도록 배열로 처리
    const existing = JSON.parse(localStorage.getItem("userBusDataList") || "[]");
    existing.push(formData);
    localStorage.setItem("userBusDataList", JSON.stringify(existing));

    alert("알림이 저장되었습니다!");
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
            <p>정류소 : ${item.stop}</p>
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
        existing.splice(idx, 1); // 해당 인덱스 항목 제거
        localStorage.setItem("userBusDataList", JSON.stringify(existing));
        alert("알림이 삭제되었습니다!");
        location.reload(); // 화면 새로고침해서 반영
    }
    else {
        alert("삭제할 알림을 찾을 수 없습니다.");
    }
}