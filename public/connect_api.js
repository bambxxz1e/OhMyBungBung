// 정류소 검색
async function searchBusStop() {
    const stopName = document.getElementById('searchStop').value.trim();
    if (!stopName) {
        alert('정류소명을 입력해주세요.');
        return;
    }

    try {
        showLoading(true);
        const response = await fetch(`/api/bus/stations?stSrch=${encodeURIComponent(stopName)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const xmlText = await response.text();
        console.log('서버로부터 받은 XML 응답:', xmlText);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const headerCd = xmlDoc.querySelector('headerCd')?.textContent;
        const headerMsg = xmlDoc.querySelector('headerMsg')?.textContent;

        if (headerCd !== '0') throw new Error(`API 오류: ${headerMsg}`);

        const stations = xmlDoc.querySelectorAll('itemList');
        const stationList = Array.from(stations).map(station => ({
            arsId: station.querySelector('arsId')?.textContent || '',
            stNm: station.querySelector('stNm')?.textContent || '',
            stId: station.querySelector('stId')?.textContent || '',
            posX: station.querySelector('posX')?.textContent || '',
            posY: station.querySelector('posY')?.textContent || ''
        }));

        console.log('파싱된 정류소 목록 (JSON):', stationList);

        showLoading(false);
        if (stationList.length > 0) {
            showStationSelector(stationList);
        } else {
            alert('검색된 정류소가 없습니다.');
        }

    } catch (error) {
        console.error('정류소 검색 중 오류 발생:', error);
        showLoading(false);
        alert(`정류소 검색 중 오류가 발생했습니다: ${error.message}`);
    }
}

// 정류소 선택 관련
function showStationSelector(stationList) {
    removeModal('stationModal');
    const modalHTML = `
        <div id="stationModal" class="modal-overlay">
            <div class="modal-content">
                <h3>정류소를 선택하세요</h3>
                <div class="station-list">
                    ${stationList.map((station, index) => `
                        <div class="station-item" onclick="selectStation(${index})">
                            <div class="station-name">${station.stNm}</div>
                            <div class="station-id">정류소 ID : ${station.stId}</div>
                            <div class="station-ars">고유번호 : ${station.arsId}</div>
                        </div>`).join('')}
                </div>
                <button class="close-modal" onclick="closeStationModal()">취소</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.currentStationList = stationList;
}

function selectStation(index) {
    const selectedStation = window.currentStationList[index];
    selectedStopInfo.name = selectedStation.stNm;
    selectedStopInfo.id = selectedStation.stId;
    selectedStopInfo.arsId = selectedStation.arsId;

    console.log('선택된 정류소 정보 :', selectedStopInfo);
    document.getElementById('searchStop').value = selectedStation.stNm;
    closeStationModal();
    showCustomPopup("✅정류소가 선택되었습니다");
}

function closeStationModal() {
    removeModal('stationModal');
    delete window.currentStationList;
}

// =========================================================================================

// 버스 노선 검색
async function searchBusLine() {
    const busNumber = document.getElementById('searchBus').value.trim();
    if (!busNumber) {
        alert('버스 번호를 입력해주세요.');
        return;
    }

    try {
        showBusLoading(true);
        const response = await fetch(`/api/bus/routes?strSrch=${encodeURIComponent(busNumber)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const xmlText = await response.text();
        console.log('버스 노선 검색 XML 응답:', xmlText);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const headerCd = xmlDoc.querySelector('headerCd')?.textContent;
        const headerMsg = xmlDoc.querySelector('headerMsg')?.textContent;

        if (headerCd !== '0') throw new Error(`API 오류: ${headerMsg}`);

        const routes = xmlDoc.querySelectorAll('itemList');
        const routeList = Array.from(routes).map(route => ({
            busRouteId: route.querySelector('busRouteId')?.textContent || '',
            busRouteNm: route.querySelector('busRouteNm')?.textContent || '',
            routeType: route.querySelector('routeType')?.textContent || '',
            stStationNm: route.querySelector('stStationNm')?.textContent || '',
            edStationNm: route.querySelector('edStationNm')?.textContent || ''
        }));

        console.log('파싱된 버스 노선 목록 (JSON):', routeList);

        showBusLoading(false);
        if (routeList.length > 0) {
            showBusRouteSelector(routeList);
        } else {
            alert('검색된 버스 노선이 없습니다.');
        }

    } catch (error) {
        console.error('버스 노선 검색 중 오류 발생:', error);
        showBusLoading(false);
        alert(`버스 노선 검색 중 오류가 발생했습니다: ${error.message}`);
    }
}

// 버스 노선 선택 관련
function showBusRouteSelector(routeList) {
    removeModal('busRouteModal');
    const modalHTML = `
        <div id="busRouteModal" class="modal-overlay">
            <div class="modal-content">
                <h3>버스 노선을 선택하세요</h3>
                <div class="route-list">
                    ${routeList.map((route, index) => `
                        <div class="route-item" onclick="selectBusRoute(${index})">
                            <div class="route-name">${route.busRouteNm}</div>
                            <div class="route-info">${route.stStationNm} ↔ ${route.edStationNm}</div>
                            <div class="route-id">노선 ID : ${route.busRouteId}</div>
                        </div>`).join('')}
                </div>
                <button class="close-modal" onclick="closeBusRouteModal()">취소</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window.currentBusRouteList = routeList;
}

// 버스 노선 선택 시 유효성 검사 포함
async function selectBusRoute(index) {
    const selectedRoute = window.currentBusRouteList[index];
    
    // 정류소가 선택되지 않은 경우
    if (!selectedStopInfo.arsId) {
        alert('먼저 정류소를 선택해주세요.');
        return;
    }
    
    try {
        // 로딩 표시
        showBusLoading(true);
        
        // 선택된 정류소를 지나는 버스 노선 목록 조회
        const isValidRoute = await validateBusRoute(selectedStopInfo.arsId, selectedRoute.busRouteId);
        
        showBusLoading(false);
        
        if (isValidRoute) {
            // 유효한 노선인 경우
            selectedBusInfo.number = selectedRoute.busRouteNm;
            selectedBusInfo.routeId = selectedRoute.busRouteId;
            selectedBusInfo.routeType = selectedRoute.routeType;

            console.log('선택된 버스 노선 정보:', selectedBusInfo);
            document.getElementById('searchBus').value = selectedRoute.busRouteNm;
            closeBusRouteModal();
            showCustomPopup("✅ 버스 노선이 선택되었습니다");
        } else {
            // 유효하지 않은 노선인 경우
            alert(`${selectedRoute.busRouteNm} 버스는 선택된 정류소(${selectedStopInfo.stationNm})를 지나지 않습니다.\n다른 버스 노선을 선택해주세요.`);
        }
        
    } catch (error) {
        showBusLoading(false);
        console.error('버스 노선 유효성 검사 중 오류:', error);
        alert('버스 노선 유효성 검사 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}

// 버스 노선 유효성 검사 함수
async function validateBusRoute(arsId, selectedRouteId) {
    try {
        console.log(`버스 노선 유효성 검사 시작 - 정류소 ID: ${arsId}, 선택된 노선 ID: ${selectedRouteId}`);
        
        const response = await fetch(`/api/bus/station-routes?arsId=${encodeURIComponent(arsId)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const xmlText = await response.text();
        console.log('정류소별 노선 조회 XML 응답:', xmlText);

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

        const headerCd = xmlDoc.querySelector('headerCd')?.textContent;
        const headerMsg = xmlDoc.querySelector('headerMsg')?.textContent;

        if (headerCd !== '0') {
            throw new Error(`API 오류: ${headerMsg}`);
        }

        // 정류소를 지나는 모든 버스 노선 조회
        const routes = xmlDoc.querySelectorAll('itemList');
        const stationRoutes = Array.from(routes).map(route => ({
            busRouteId: route.querySelector('busRouteId')?.textContent || '',
            busRouteNm: route.querySelector('busRouteNm')?.textContent || ''
        }));

        console.log('정류소를 지나는 버스 노선 목록:', stationRoutes);

        // 선택된 버스 노선이 정류소를 지나는지 확인
        const isValid = stationRoutes.some(route => route.busRouteId === selectedRouteId);
        
        console.log(`유효성 검사 결과: ${isValid ? '유효함' : '유효하지 않음'}`);
        
        return isValid;

    } catch (error) {
        console.error('버스 노선 유효성 검사 중 오류:', error);
        throw error;
    }
}

// 모달 닫기
function closeBusRouteModal() {
    removeModal('busRouteModal');
}

// =====================================================================================

// 로딩 표시 함수
function showLoading(show) {
    const stopSearchBtn = document.querySelectorAll('.search-btn')[0];
    if (stopSearchBtn) {
        stopSearchBtn.textContent = show ? '검색중...' : '검색하기';
        stopSearchBtn.disabled = show;
    }
}

function showBusLoading(show) {
    const busSearchBtn = document.querySelectorAll('.search-btn')[1];
    if (busSearchBtn) {
        busSearchBtn.textContent = show ? '검색중...' : '검색하기';
        busSearchBtn.disabled = show;
    }
}

// 모달 제거
function removeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

// 커스텀 팝업
function showCustomPopup(message) {
    removeModal('customPopup');
    const popupHTML = `
        <div id="customPopup">
            ${message}
            <div>
                <button id="popupCloseBtn">확인</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', popupHTML);
    document.getElementById('popupCloseBtn').addEventListener('click', () => {
        removeModal('customPopup');
    });
}

// ===============================================================================

// 서버 상태 확인
async function checkServerStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        console.log('서버 상태:', data);
        return data.status === 'OK';
    } catch (error) {
        console.error('서버 연결 실패:', error);
        return false;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const isServerOnline = await checkServerStatus();
    if (!isServerOnline) {
        console.warn('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    } else {
        console.log('✅ 서버가 정상적으로 연결되었습니다.');
    }
});