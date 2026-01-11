// Firebase 초기화
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, off } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyDUw-dI0d-orA3yemPZPNqJgs8sgS1TXB4",
    authDomain: "todo-backendseason2.firebaseapp.com",
    projectId: "todo-backendseason2",
    storageBucket: "todo-backendseason2.firebasestorage.app",
    messagingSenderId: "513786190314",
    appId: "1:513786190314:web:3e791a9843f5d4dbceba93",
    databaseURL: "https://todo-backendseason2-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
let app;
let db;

try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    console.log('✅ Firebase Realtime Database 초기화 성공');
} catch (error) {
    console.error('❌ Firebase 초기화 오류:', error);
    db = null;
}

// 전역 변수
let currentDate = new Date();
let selectedDate = null;
let todos = JSON.parse(localStorage.getItem('todos')) || {};
let editingTodoId = null;

// DOM 요소 (초기화 함수에서 가져오기)
let currentMonthYearEl;
let calendarDaysEl;
let prevMonthBtn;
let nextMonthBtn;
let todoSection;
let selectedDateEl;
let closeTodoSectionBtn;
let todoInput;
let addTodoBtn;
let todoItemsEl;
let progressItemsEl;
let completedItemsEl;
let todoCountEl;
let progressCountEl;
let completedCountEl;
let editModal;
let editTodoInput;
let saveEditBtn;
let cancelEditBtn;
let modalClose;

// DOM 요소 초기화
function initDOMElements() {
    currentMonthYearEl = document.getElementById('currentMonthYear');
    calendarDaysEl = document.getElementById('calendarDays');
    prevMonthBtn = document.getElementById('prevMonth');
    nextMonthBtn = document.getElementById('nextMonth');
    todoSection = document.getElementById('todoSection');
    selectedDateEl = document.getElementById('selectedDate');
    closeTodoSectionBtn = document.getElementById('closeTodoSection');
    todoInput = document.getElementById('todoInput');
    addTodoBtn = document.getElementById('addTodoBtn');
    todoItemsEl = document.getElementById('todoItems');
    progressItemsEl = document.getElementById('progressItems');
    completedItemsEl = document.getElementById('completedItems');
    todoCountEl = document.getElementById('todoCount');
    progressCountEl = document.getElementById('progressCount');
    completedCountEl = document.getElementById('completedCount');
    editModal = document.getElementById('editModal');
    editTodoInput = document.getElementById('editTodoInput');
    saveEditBtn = document.getElementById('saveEditBtn');
    cancelEditBtn = document.getElementById('cancelEditBtn');
    modalClose = document.querySelector('.modal-close');
}

// 초기화
function init() {
    // DOM 요소 초기화
    initDOMElements();
    
    // 필수 DOM 요소 확인
    if (!currentMonthYearEl || !calendarDaysEl) {
        console.error('필수 DOM 요소를 찾을 수 없습니다. 잠시 후 다시 시도합니다.');
        setTimeout(init, 100);
        return;
    }
    
    // 먼저 달력을 렌더링 (데이터 로드와 무관하게 표시)
    renderCalendar();
    
    // 오늘 날짜를 자동으로 선택하여 할 일 관리 패널 표시
    const today = new Date();
    selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    showTodoSection(selectedDate);
    
    setupEventListeners();
    
    // Firebase 데이터는 비동기로 로드
    loadTodosFromFirebase().then(() => {
        // 데이터 로드 후 달력 업데이트
        renderCalendar();
        if (selectedDate) {
            const dateKey = formatDateKey(selectedDate);
            renderTodos(dateKey);
        }
    }).catch(error => {
        console.error('Firebase 초기화 오류:', error);
        // 오류가 있어도 달력은 표시됨
    });
}

// Firebase에서 할 일 로드
async function loadTodosFromFirebase() {
    try {
        // Firebase 연결 확인
        if (!db) {
            console.warn('⚠️ Firebase가 초기화되지 않았습니다. 로컬 스토리지에서 로드합니다.');
            const localTodos = localStorage.getItem('todos');
            if (localTodos) {
                todos = JSON.parse(localTodos);
                console.log('✅ 로컬 스토리지에서 데이터 로드 완료:', Object.keys(todos).length, '개 날짜');
            }
            return;
        }

        console.log('🔄 Firebase Realtime Database 연결 확인 중...');
        const todosRef = ref(db, 'todos/allTodos');
        const snapshot = await get(todosRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            todos = data.todos || {};
            
            // 기존 데이터 마이그레이션 (시간 필드 추가)
            let migratedCount = 0;
            for (const dateKey in todos) {
                todos[dateKey].forEach(todo => {
                    if (!todo.todoUpdatedAt && todo.status === 'todo') {
                        todo.todoUpdatedAt = todo.createdAt || new Date().toISOString();
                        migratedCount++;
                    }
                    if (!todo.progressUpdatedAt) todo.progressUpdatedAt = null;
                    if (!todo.completedUpdatedAt) todo.completedUpdatedAt = null;
                });
            }
            if (migratedCount > 0) {
                console.log(`📝 기존 데이터 마이그레이션 완료: ${migratedCount}개 할 일`);
                await saveTodosToFirebase();
            }
            
            console.log('✅ Firebase Realtime Database에서 데이터 로드 성공:', Object.keys(todos).length, '개 날짜');
            console.log('📦 Firebase 데이터:', JSON.stringify(todos).substring(0, 200));
        } else {
            console.log('ℹ️ Firebase에 데이터가 없습니다. 로컬 스토리지에서 로드합니다.');
            // Firebase에 데이터가 없으면 로컬 스토리지에서 로드
            const localTodos = localStorage.getItem('todos');
            if (localTodos) {
                todos = JSON.parse(localTodos);
                console.log('✅ 로컬 스토리지에서 데이터 로드:', Object.keys(todos).length, '개 날짜');
                // 로컬 데이터를 Firebase에 저장
                try {
                    await saveTodosToFirebase();
                    console.log('✅ 로컬 데이터를 Firebase에 백업 완료');
                } catch (saveError) {
                    console.error('❌ Firebase 백업 오류:', saveError);
                }
            } else {
                todos = {};
                console.log('📝 데이터가 없습니다. 새로 시작합니다.');
            }
        }
        
        // 실시간 업데이트 리스너 설정
        if (db) {
            setupRealtimeListener();
            console.log('✅ Firebase 실시간 리스너 설정 완료!');
        }
    } catch (error) {
        console.error('❌ Firebase 데이터 로드 오류:', error);
        console.error('오류 상세:', error.message, error.code, error.stack);
        // 오류 발생 시 로컬 스토리지에서 로드
        const localTodos = localStorage.getItem('todos');
        if (localTodos) {
            todos = JSON.parse(localTodos);
            console.log('✅ 오류 발생으로 로컬 스토리지에서 데이터 로드');
        } else {
            todos = {};
        }
    }
}

// 실시간 업데이트 리스너 설정
let realtimeListener = null;

function setupRealtimeListener() {
    if (!db) {
        console.warn('⚠️ Firebase가 없어 실시간 리스너를 설정할 수 없습니다.');
        return;
    }

    try {
        // 기존 리스너 제거
        if (realtimeListener) {
            const todosRef = ref(db, 'todos/allTodos');
            off(todosRef, 'value', realtimeListener);
        }

        const todosRef = ref(db, 'todos/allTodos');
        
        realtimeListener = (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                todos = data.todos || {};
                console.log('🔄 Firebase Realtime Database 실시간 업데이트:', Object.keys(todos).length, '개 날짜');
                renderCalendar();
                
                // 현재 선택된 날짜가 있으면 해당 날짜의 할 일도 다시 렌더링
                if (selectedDate) {
                    const dateKey = formatDateKey(selectedDate);
                    renderTodos(dateKey);
                }
            } else {
                console.log('ℹ️ Firebase 데이터가 삭제되었습니다.');
                todos = {};
                renderCalendar();
                if (selectedDate) {
                    const dateKey = formatDateKey(selectedDate);
                    renderTodos(dateKey);
                }
            }
        };

        onValue(todosRef, realtimeListener, (error) => {
            console.error('❌ 실시간 업데이트 오류:', error);
        });
        
        console.log('✅ Firebase Realtime Database 실시간 리스너 설정 성공');
    } catch (error) {
        console.error('❌ 실시간 리스너 설정 오류:', error);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    prevMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    closeTodoSectionBtn.addEventListener('click', () => {
        todoSection.style.display = 'none';
        selectedDate = null;
        renderCalendar(); // 선택된 날짜 표시 제거를 위해 달력 다시 렌더링
    });

    addTodoBtn.addEventListener('click', addTodo);
    todoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    saveEditBtn.addEventListener('click', saveEdit);
    cancelEditBtn.addEventListener('click', closeEditModal);
    modalClose.addEventListener('click', closeEditModal);

    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });

    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabName = btn.dataset.tab;
            const targetList = document.getElementById(`${tabName}List`);
            if (targetList) {
                targetList.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// 달력 렌더링
function renderCalendar() {
    // DOM 요소 확인
    if (!currentMonthYearEl || !calendarDaysEl) {
        console.error('달력 DOM 요소를 찾을 수 없습니다.');
        return;
    }

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    currentMonthYearEl.textContent = `${year}년 ${month + 1}월`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    calendarDaysEl.innerHTML = '';

    // 이전 달의 날짜들
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const date = new Date(year, month - 1, day);
        createCalendarDay(date, true);
    }

    // 이번 달의 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        createCalendarDay(date, false);
    }

    // 다음 달의 날짜들 (총 42개 셀 유지)
    const totalCells = calendarDaysEl.children.length;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        const date = new Date(year, month + 1, day);
        createCalendarDay(date, true);
    }
}

// 달력 날짜 셀 생성
function createCalendarDay(date, isOtherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    
    if (isOtherMonth) {
        dayEl.classList.add('other-month');
    }

    const dateKey = formatDateKey(date);
    const dayTodos = todos[dateKey] || [];
    const dayNumber = date.getDate();
    const todoCount = dayTodos.length;

    // 오늘 날짜 표시
    const today = new Date();
    if (!isOtherMonth && 
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()) {
        dayEl.classList.add('today');
    }

    // 선택된 날짜 표시
    if (selectedDate && 
        !isOtherMonth &&
        date.getFullYear() === selectedDate.getFullYear() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getDate() === selectedDate.getDate()) {
        dayEl.classList.add('selected');
    }

    // 할 일이 있는 날짜 표시
    if (todoCount > 0) {
        dayEl.classList.add('has-todos');
    }

    // 공휴일 체크
    const holidayInfo = isHoliday(date);
    if (holidayInfo.isHoliday && !isOtherMonth) {
        dayEl.classList.add('holiday');
        dayEl.dataset.holidayName = holidayInfo.name;
    }

    dayEl.innerHTML = `
        <div class="day-number">${dayNumber}</div>
        ${todoCount > 0 ? `<div class="todo-count">${todoCount}개</div>` : ''}
        ${holidayInfo.isHoliday && !isOtherMonth && holidayInfo.name !== '일요일' ? `<div class="holiday-label">${holidayInfo.name}</div>` : ''}
    `;

    dayEl.addEventListener('click', () => {
        selectedDate = new Date(date);
        showTodoSection(date);
        renderCalendar(); // 선택된 날짜 표시를 위해 달력 다시 렌더링
    });

    calendarDaysEl.appendChild(dayEl);
}

// 한국 공휴일 목록 (년도별)
function getHolidays(year) {
    const holidays = {};
    
    // 양력 고정 공휴일
    holidays[`${year}-01-01`] = '신정';
    holidays[`${year}-03-01`] = '삼일절';
    holidays[`${year}-05-05`] = '어린이날';
    holidays[`${year}-06-06`] = '현충일';
    holidays[`${year}-08-15`] = '광복절';
    holidays[`${year}-10-03`] = '개천절';
    holidays[`${year}-10-09`] = '한글날';
    holidays[`${year}-12-25`] = '크리스마스';
    
    // 음력 공휴일 (2024-2026년 주요 공휴일)
    // 설날 (음력 1월 1일)
    if (year === 2024) {
        holidays['2024-02-10'] = '설날';
        holidays['2024-02-11'] = '설날';
        holidays['2024-02-12'] = '설날';
        // 부처님오신날 (음력 4월 8일)
        holidays['2024-05-15'] = '부처님오신날';
        // 추석 (음력 8월 15일)
        holidays['2024-09-16'] = '추석';
        holidays['2024-09-17'] = '추석';
        holidays['2024-09-18'] = '추석';
    } else if (year === 2025) {
        holidays['2025-01-28'] = '설날';
        holidays['2025-01-29'] = '설날';
        holidays['2025-01-30'] = '설날';
        holidays['2025-05-05'] = '부처님오신날'; // 5월 5일은 어린이날과 겹침
        holidays['2025-10-05'] = '추석';
        holidays['2025-10-06'] = '추석';
        holidays['2025-10-07'] = '추석';
    } else if (year === 2026) {
        holidays['2026-02-16'] = '설날';
        holidays['2026-02-17'] = '설날';
        holidays['2026-02-18'] = '설날';
        holidays['2026-05-24'] = '부처님오신날';
        holidays['2026-09-24'] = '추석';
        holidays['2026-09-25'] = '추석';
        holidays['2026-09-26'] = '추석';
    }
    
    // 일요일 공휴일 체크 (일요일은 자동으로 공휴일)
    // 하지만 일요일은 이미 빨간색이므로 별도 처리 불필요
    
    return holidays;
}

// 공휴일인지 확인
function isHoliday(date) {
    const year = date.getFullYear();
    const holidays = getHolidays(year);
    const dateKey = formatDateKey(date);
    
    // 공휴일 체크
    if (holidays[dateKey]) {
        return { isHoliday: true, name: holidays[dateKey] };
    }
    
    // 일요일 체크 (0 = 일요일)
    if (date.getDay() === 0) {
        return { isHoliday: true, name: '일요일' };
    }
    
    return { isHoliday: false, name: null };
}

// 날짜 키 포맷팅 (YYYY-MM-DD)
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 할 일 섹션 표시
function showTodoSection(date) {
    const dateKey = formatDateKey(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    selectedDateEl.textContent = date.toLocaleDateString('ko-KR', options);
    
    todoSection.style.display = 'block';
    renderTodos(dateKey);
}

// 할 일 목록 렌더링
function renderTodos(dateKey) {
    const dateTodos = todos[dateKey] || [];
    const todoTodos = dateTodos.filter(todo => todo.status === 'todo' || !todo.status);
    const progressTodos = dateTodos.filter(todo => todo.status === 'progress');
    const completedTodos = dateTodos.filter(todo => todo.status === 'completed');

    todoItemsEl.innerHTML = '';
    progressItemsEl.innerHTML = '';
    completedItemsEl.innerHTML = '';

    todoTodos.forEach(todo => {
        const todoEl = createTodoElement(todo, dateKey);
        todoItemsEl.appendChild(todoEl);
    });

    progressTodos.forEach(todo => {
        const todoEl = createTodoElement(todo, dateKey);
        progressItemsEl.appendChild(todoEl);
    });

    completedTodos.forEach(todo => {
        const todoEl = createTodoElement(todo, dateKey);
        completedItemsEl.appendChild(todoEl);
    });

    todoCountEl.textContent = todoTodos.length;
    progressCountEl.textContent = progressTodos.length;
    completedCountEl.textContent = completedTodos.length;
    document.querySelector('[data-tab="todo"]').innerHTML = `할 일 목록 (<span id="todoCount">${todoTodos.length}</span>)`;
    document.querySelector('[data-tab="progress"]').innerHTML = `할일 진행 (<span id="progressCount">${progressTodos.length}</span>)`;
    document.querySelector('[data-tab="completed"]').innerHTML = `할일 완료 (<span id="completedCount">${completedTodos.length}</span>)`;

    setupDragAndDrop(dateKey);
}

// 날짜 시간 포맷팅 함수
function formatDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    
    return date.toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 할 일 요소 생성
function createTodoElement(todo, dateKey) {
    const todoEl = document.createElement('div');
    todoEl.className = 'todo-item';
    if (todo.status === 'completed') {
        todoEl.classList.add('completed-item');
    }
    todoEl.draggable = true;
    todoEl.dataset.todoId = todo.id;

    // 상태별 업데이트 시간 가져오기
    let updateTimeText = '';
    let updateTimeLabel = '';
    
    if (todo.status === 'todo' && todo.todoUpdatedAt) {
        updateTimeLabel = '등록';
        updateTimeText = formatDateTime(todo.todoUpdatedAt);
    } else if (todo.status === 'progress' && todo.progressUpdatedAt) {
        updateTimeLabel = '진행 시작';
        updateTimeText = formatDateTime(todo.progressUpdatedAt);
    } else if (todo.status === 'completed' && todo.completedUpdatedAt) {
        updateTimeLabel = '완료';
        updateTimeText = formatDateTime(todo.completedUpdatedAt);
    }

    todoEl.innerHTML = `
        <div class="todo-item-content-wrapper">
            <div class="todo-item-content">${todo.text}</div>
            ${updateTimeText ? `<div class="todo-item-time">${updateTimeLabel}: ${updateTimeText}</div>` : ''}
        </div>
        <div class="todo-item-actions">
            <button class="todo-item-btn edit-btn" onclick="editTodo('${todo.id}', '${dateKey}')">✏️</button>
            <button class="todo-item-btn delete-btn" onclick="deleteTodo('${todo.id}', '${dateKey}')">🗑️</button>
        </div>
    `;

    // 드래그 이벤트 (새로 추가될 때마다 다시 설정)
    todoEl.addEventListener('dragstart', (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.dropEffect = 'move';
        const dragData = JSON.stringify({ todoId: todo.id, dateKey });
        e.dataTransfer.setData('text/plain', dragData);
        e.dataTransfer.setData('application/json', dragData);
        todoEl.classList.add('dragging');
        console.log('🖱️ 드래그 시작:', { todoId: todo.id, text: todo.text, status: todo.status, dateKey });
        
        // 모든 리스트에 drag-over 가능하도록 표시
        document.querySelectorAll('.todo-list').forEach(list => {
            list.style.pointerEvents = 'auto';
        });
    });

    todoEl.addEventListener('dragend', (e) => {
        e.stopPropagation();
        todoEl.classList.remove('dragging');
        // 모든 리스트에서 drag-over 클래스 제거
        document.querySelectorAll('.todo-list').forEach(list => {
            list.classList.remove('drag-over');
        });
        console.log('🖱️ 드래그 종료');
    });
    
    // 드래그 중 커서 스타일
    todoEl.style.cursor = 'move';

    return todoEl;
}

// 할 일 추가
async function addTodo() {
    const text = todoInput.value.trim();
    if (!text || !selectedDate) {
        if (!selectedDate) {
            alert('날짜를 선택해주세요.');
        }
        return;
    }

    const dateKey = formatDateKey(selectedDate);
    if (!todos[dateKey]) {
        todos[dateKey] = [];
    }

    const newTodo = {
        id: Date.now().toString(),
        text: text,
        status: 'todo',
        createdAt: new Date().toISOString(),
        todoUpdatedAt: new Date().toISOString(), // 할 일 목록에 추가된 시간
        progressUpdatedAt: null,
        completedUpdatedAt: null
    };

    todos[dateKey].push(newTodo);
    
    // 입력창 즉시 초기화 (사용자 경험 개선)
    todoInput.value = '';
    
    try {
        await saveTodosToFirebase();
        console.log('할 일 추가 및 Firebase 저장 성공:', newTodo);
        renderTodos(dateKey);
        renderCalendar(); // 달력 업데이트
    } catch (error) {
        console.error('할 일 추가 오류:', error);
        alert('할 일 추가에 실패했습니다: ' + error.message);
        // 실패 시 롤백 및 입력창 복구
        todos[dateKey].pop();
        todoInput.value = text;
    }
}

// 할 일 수정
function editTodo(todoId, dateKey) {
    const todo = todos[dateKey].find(t => t.id === todoId);
    if (!todo) return;

    editingTodoId = { todoId, dateKey };
    editTodoInput.value = todo.text;
    editModal.style.display = 'block';
    editTodoInput.focus();
}

// 수정 저장
async function saveEdit() {
    if (!editingTodoId) return;

    const { todoId, dateKey } = editingTodoId;
    const todo = todos[dateKey].find(t => t.id === todoId);
    if (todo) {
        const originalText = todo.text;
        todo.text = editTodoInput.value.trim();
        try {
            await saveTodosToFirebase();
            renderTodos(dateKey);
            closeEditModal();
        } catch (error) {
            console.error('할 일 수정 오류:', error);
            alert('할 일 수정에 실패했습니다. 다시 시도해주세요.');
            // 실패 시 롤백
            todo.text = originalText;
        }
    }
}

// 수정 모달 닫기
function closeEditModal() {
    editModal.style.display = 'none';
    editingTodoId = null;
    editTodoInput.value = '';
}

// 할 일 삭제
async function deleteTodo(todoId, dateKey) {
    // dateKey가 없거나 todos[dateKey]가 없으면 찾아봅니다
    if (!dateKey || !todos[dateKey]) {
        // 모든 날짜에서 해당 할 일 찾기
        for (const key in todos) {
            const found = todos[key].find(t => t.id === todoId);
            if (found) {
                dateKey = key;
                break;
            }
        }
    }

    if (!dateKey || !todos[dateKey]) {
        console.error('삭제할 할 일을 찾을 수 없습니다:', todoId);
        alert('할 일을 찾을 수 없습니다.');
        return;
    }

    if (confirm('정말 삭제하시겠습니까?')) {
        const originalTodos = JSON.parse(JSON.stringify(todos)); // 깊은 복사
        
        todos[dateKey] = todos[dateKey].filter(t => t.id !== todoId);
        
        // 할 일이 없으면 날짜 키 삭제
        if (todos[dateKey].length === 0) {
            delete todos[dateKey];
        }
        
        try {
            await saveTodosToFirebase();
            console.log('할 일 삭제 성공:', todoId);
            renderTodos(dateKey);
            renderCalendar(); // 달력 업데이트
        } catch (error) {
            console.error('할 일 삭제 오류:', error);
            alert('할 일 삭제에 실패했습니다: ' + error.message);
            // 실패 시 롤백
            todos = originalTodos;
            renderTodos(dateKey);
            renderCalendar();
        }
    }
}

// 드래그앤드롭 설정
let dragAndDropListeners = [];

function setupDragAndDrop(dateKey) {
    // 기존 리스너 제거
    dragAndDropListeners.forEach(({ element, handlers }) => {
        handlers.forEach(({ event, handler }) => {
            element.removeEventListener(event, handler);
        });
    });
    dragAndDropListeners = [];

    const todoList = document.getElementById('todoList');
    const progressList = document.getElementById('progressList');
    const completedList = document.getElementById('completedList');

    if (!todoList || !progressList || !completedList) {
        console.error('드래그앤드롭 리스트를 찾을 수 없습니다.');
        return;
    }

    const lists = [
        { element: todoList, items: todoItemsEl, status: 'todo' },
        { element: progressList, items: progressItemsEl, status: 'progress' },
        { element: completedList, items: completedItemsEl, status: 'completed' }
    ];

    lists.forEach(({ element, items, status }) => {
        const handleDragOver = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'move';
                e.dataTransfer.effectAllowed = 'move';
            }
            element.classList.add('drag-over');
            // items 컨테이너에도 표시
            if (items) {
                items.classList.add('drag-over');
            }
        };

        const handleDragLeave = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 자식 요소로 이동하는 경우는 제외
            const relatedTarget = e.relatedTarget;
            if (!relatedTarget || (!element.contains(relatedTarget) && (!items || !items.contains(relatedTarget)))) {
                element.classList.remove('drag-over');
                if (items) {
                    items.classList.remove('drag-over');
                }
            }
        };

        const handleDrop = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            element.classList.remove('drag-over');
            if (items) {
                items.classList.remove('drag-over');
            }

            try {
                let dataStr = e.dataTransfer.getData('text/plain');
                if (!dataStr) {
                    dataStr = e.dataTransfer.getData('application/json');
                }
                
                if (!dataStr) {
                    console.log('⚠️ 드롭 데이터가 없습니다.');
                    return;
                }

                const data = JSON.parse(dataStr);
                const { todoId, dateKey: sourceDateKey } = data;

                console.log('🎯 드롭 이벤트 발생:', { 
                    todoId, 
                    sourceDateKey, 
                    targetStatus: status, 
                    currentDateKey: dateKey 
                });

                // 같은 날짜의 할 일만 이동 가능
                if (sourceDateKey !== dateKey) {
                    console.log('⚠️ 다른 날짜의 할 일은 이동할 수 없습니다.');
                    return;
                }

                if (!todos[dateKey]) {
                    console.log('⚠️ 해당 날짜에 할 일이 없습니다.');
                    return;
                }

                const todo = todos[dateKey].find(t => t.id === todoId);
                if (!todo) {
                    console.log('⚠️ 할 일을 찾을 수 없습니다:', todoId);
                    return;
                }

                const originalStatus = todo.status;
                
                // 상태가 변경되는 경우에만 업데이트
                if (todo.status !== status) {
                    todo.status = status;
                    
                    // 상태별 업데이트 시간 기록
                    const now = new Date().toISOString();
                    if (status === 'todo') {
                        todo.todoUpdatedAt = now;
                    } else if (status === 'progress') {
                        todo.progressUpdatedAt = now;
                    } else if (status === 'completed') {
                        todo.completedUpdatedAt = now;
                    }
                    
                    console.log(`✅ 할 일 상태 변경: "${todo.text}" - ${originalStatus} -> ${status}`);
                    
                    try {
                        await saveTodosToFirebase();
                        console.log('✅ 드래그앤드롭 Firebase 저장 성공');
                        renderTodos(dateKey);
                        renderCalendar(); // 달력 업데이트
                    } catch (error) {
                        console.error('❌ 드래그앤드롭 저장 오류:', error);
                        // 실패 시 롤백
                        todo.status = originalStatus;
                        renderTodos(dateKey);
                        alert('할 일 이동에 실패했습니다: ' + error.message);
                    }
                } else {
                    console.log('ℹ️ 같은 상태로 이동할 수 없습니다. 현재 상태:', status);
                }
            } catch (error) {
                console.error('❌ 드롭 처리 오류:', error);
                console.error('오류 상세:', error.message, error.stack);
            }
        };

        // 리스트 자체에 이벤트 추가
        const handlers = [
            { event: 'dragover', handler: handleDragOver },
            { event: 'dragleave', handler: handleDragLeave },
            { event: 'drop', handler: handleDrop }
        ];

        handlers.forEach(({ event, handler }) => {
            element.addEventListener(event, handler);
        });

        dragAndDropListeners.push({ element, handlers });

        // todo-items 컨테이너에도 추가 (더 넓은 드롭 영역)
        if (items) {
            const itemHandlers = [
                { event: 'dragover', handler: handleDragOver },
                { event: 'dragleave', handler: handleDragLeave },
                { event: 'drop', handler: handleDrop }
            ];

            itemHandlers.forEach(({ event, handler }) => {
                items.addEventListener(event, handler);
            });

            dragAndDropListeners.push({ element: items, handlers: itemHandlers });
        }
    });
}

// Firebase에 할 일 저장
async function saveTodosToFirebase() {
    // 항상 로컬 스토리지에도 먼저 저장 (빠른 피드백)
    localStorage.setItem('todos', JSON.stringify(todos));
    console.log('💾 로컬 스토리지 저장 완료');
    
    try {
        // Firebase 연결 확인
        if (!db) {
            console.warn('⚠️ Firebase가 초기화되지 않았습니다. 로컬 스토리지에만 저장합니다.');
            return;
        }

        console.log('🔄 Firebase Realtime Database에 저장 중...');
        const todosRef = ref(db, 'todos/allTodos');
        const dataToSave = { todos: todos };
        
        await set(todosRef, dataToSave);
        
        // 저장 확인
        const verifySnapshot = await get(todosRef);
        if (verifySnapshot.exists()) {
            const savedData = verifySnapshot.val();
            console.log('✅ Firebase Realtime Database 저장 성공 및 확인 완료!');
            console.log('📦 저장된 데이터:', Object.keys(savedData.todos || {}).length, '개 날짜');
            console.log('📝 데이터 미리보기:', JSON.stringify(todos).substring(0, 200) + '...');
            console.log('🔗 저장 경로: todos/allTodos');
        } else {
            console.error('❌ Firebase 저장 후 확인 실패 - 데이터가 존재하지 않습니다.');
        }
    } catch (error) {
        console.error('❌ Firebase 저장 오류:', error);
        console.error('오류 상세:', error.message, error.code);
        if (error.stack) {
            console.error('스택 트레이스:', error.stack);
        }
        
        // Firebase 저장 실패해도 로컬 스토리지에는 저장됨
        console.log('✅ 로컬 스토리지에 백업 저장 완료');
    }
}

// 기존 함수명 유지 (다른 곳에서 사용 중일 수 있음)
function saveTodos() {
    saveTodosToFirebase().catch(error => {
        console.error('저장 오류:', error);
    });
}

// 전역 함수로 설정 (HTML에서 onclick 사용)
window.editTodo = editTodo;
window.deleteTodo = deleteTodo;

// DOM이 로드된 후 초기화 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    // DOM이 이미 로드된 경우
    init();
}
