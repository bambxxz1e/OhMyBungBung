// ================= 유틸 =================
function parseXml(xmlText) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlText, 'text/xml');
}

function getText(xml, tag) {
    return xml.querySelector(tag)?.textContent || '';
}

function fetchXml(url) {
    return fetch(url).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
    });
}

// ============= 정류소 검색 =============
async function searchBusStop() {
    const keyword = document.getElementById('searchStop').value.trim();
    if (!keyword) return alert('정류소명을 입력해주세요.');

    showLoading(true);

    try {
        const xml = parseXml(await fetchXml(`/api/bus/stations?stSrch=${encodeURIComponent(keyword)}`));
        if (getText(xml, 'headerCd') !== '0') throw new Error(getText(xml, 'headerMsg'));

        const stationList = Array.from(xml.querySelectorAll('itemList')).map(item => ({
            arsId: getText(item, 'arsId'),
            stationName: getText(item, 'stNm'),
            stationId: getText(item, 'stId'),
            posX: getText(item, 'posX'),
            posY: getText(item, 'posY')
        }));

        stationList.length ? showStationSelector(stationList) : alert('검색된 정류소가 없습니다.');
    } catch (e) {
        console.error(e);
        alert(`정류소 검색 오류: ${e.message}`);
    } finally {
        showLoading(false);
    }
}

function showStationSelector(list) {
    removeModal('stationModal');
    const html = `
        <div id="stationModal" class="modal-overlay">
            <div class="modal-content">
                <h3>정류소를 선택하세요</h3>
                <div class="station-list">
                    ${list.map((s, i) => `
                        <div class="station-item" onclick="selectStation(${i})">
                            <div class="station-name">${s.stationName}</div>
                            <div class="station-id">정류소 ID : ${s.stationId}</div>
                            <div class="station-ars">고유번호 : ${s.arsId}</div>
                        </div>`).join('')}
                </div>
                <button class="close-modal" onclick="closeStationModal()">취소</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    window.currentStationList = list;
}

function selectStation(index) {
    const selected = window.currentStationList[index];
    Object.assign(selectedStopInfo, {
        name: selected.stationName,
        id: selected.stationId,
        arsId: selected.arsId,
    });

    document.getElementById('searchStop').value = selected.stationName;
    closeStationModal();
    showCustomPopup("✅ 정류소가 선택되었습니다");
}

function closeStationModal() {
    removeModal('stationModal');
    delete window.currentStationList;
}

// ================= 버스 노선 검색 =================
async function searchBusLine() {
    const keyword = document.getElementById('searchBus').value.trim();
    if (!keyword) return alert('버스 번호를 입력해주세요.');

    showBusLoading(true);

    try {
        const xml = parseXml(await fetchXml(`/api/bus/routes?strSrch=${encodeURIComponent(keyword)}`));
        if (getText(xml, 'headerCd') !== '0') throw new Error(getText(xml, 'headerMsg'));

        const routeList = Array.from(xml.querySelectorAll('itemList')).map(item => ({
            routeId: getText(item, 'busRouteId'),
            routeName: getText(item, 'busRouteNm'),
            routeType: getText(item, 'routeType'),
            startStation: getText(item, 'stStationNm'),
            endStation: getText(item, 'edStationNm')
        }));

        routeList.length ? showBusRouteSelector(routeList) : alert('검색된 버스 노선이 없습니다.');
    } catch (e) {
        console.error(e);
        alert(`버스 노선 검색 오류: ${e.message}`);
    } finally {
        showBusLoading(false);
    }
}

async function validateBusRoute(arsId, routeId) {
    try {
        const xml = parseXml(await fetchXml(`/api/bus/station-routes?arsId=${encodeURIComponent(arsId)}`));
        if (getText(xml, 'headerCd') !== '0') throw new Error(getText(xml, 'headerMsg'));

        const routeIds = Array.from(xml.querySelectorAll('itemList')).map(item =>
            getText(item, 'busRouteId')
        );

        return routeIds.includes(routeId);
    } catch (e) {
        console.error("유효성 검사 중 오류:", e);
        throw e;
    }
}

function selectBusRoute(index) {
    const selected = window.currentBusRouteList[index];

    if (!selectedStopInfo.arsId) {
        alert("먼저 정류소를 선택해주세요.");
        return;
    }

    validateBusRoute(selectedStopInfo.arsId, selected.routeId)
        .then(isValid => {
            if (!isValid) {
                alert(`${selected.routeName} 버스는 선택된 정류소를 지나지 않습니다.`);
                return;
            }

            // 선택된 정보 저장
            Object.assign(selectedBusInfo, {
                number: selected.routeName,
                routeId: selected.routeId,
                routeType: selected.routeType,
            });

            document.getElementById('searchBus').value = selected.routeName;
            closeBusRouteModal();
            showCustomPopup("✅ 버스 노선이 선택되었습니다");
        })
        .catch(err => {
            console.error("노선 유효성 검사 실패:", err);
            alert("버스 노선 유효성 검사 중 오류가 발생했습니다.");
        });
}

function showBusRouteSelector(list) {
    removeModal('busRouteModal');
    const html = `
        <div id="busRouteModal" class="modal-overlay">
            <div class="modal-content">
                <h3>버스 노선을 선택하세요</h3>
                <div class="route-list">
                    ${list.map((r, i) => `
                        <div class="route-item" onclick="selectBusRoute(${i})">
                            <div class="route-name">${r.routeName}</div>
                            <div class="route-info">${r.startStation} ↔ ${r.endStation}</div>
                            <div class="route-id">노선 ID : ${r.routeId}</div>
                        </div>`).join('')}
                </div>
                <button class="close-modal" onclick="closeBusRouteModal()">취소</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    window.currentBusRouteList = list;
}

function showBusLoading(active) {
    const btn = document.querySelectorAll('.search-btn')[1];
    if (btn) {
        btn.textContent = active ? '검색중...' : '검색하기';
        btn.disabled = active;
    }
}

function closeBusRouteModal() {
    removeModal('busRouteModal');
}

// ============= 공통 함수 =============
function removeModal(id) {
    document.getElementById(id)?.remove();
}

function showLoading(active) {
    const btn = document.querySelectorAll('.search-btn')[0];
    if (btn) {
        btn.textContent = active ? '검색중...' : '검색하기';
        btn.disabled = active;
    }
}

function showCustomPopup(msg) {
    removeModal('customPopup');
    const popupHTML = `
        <div id="customPopup">
            ${msg}
            <div><button id="popupCloseBtn">확인</button></div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    document.getElementById('popupCloseBtn').onclick = () => removeModal('customPopup');
}
