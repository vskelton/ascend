import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, addDoc, deleteDoc, onSnapshot, collection, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1f-z76NdvB2XyVmO4aBMvnaxNBW4bJek",
  authDomain: "ascend-workout-logger.firebaseapp.com",
  projectId: "ascend-workout-logger",
  storageBucket: "ascend-workout-logger.firebasestorage.app",
  messagingSenderId: "750821235184",
  appId: "1:750821235184:web:65a466723dc31847bfe535",
  measurementId: "G-CX6L6NP0TX"
};

const appId = firebaseConfig.appId;

// UI elements
const authInfoEl = document.getElementById('auth-info');
const userIdDisplayEl = document.getElementById('user-id-display');
const messageBox = document.getElementById('message-box');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const signInBtn = document.getElementById('sign-in-btn');
const createAccountBtn = document.getElementById('create-account-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const workoutForm = document.getElementById('workout-form');
const workoutsList = document.getElementById('workouts-list');

// Firebase instances
let app, auth, db, userId;

/**
 * Displays a message in the message box.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('success' or 'error').
 */
const showMessage = (message, type) => {
  messageBox.textContent = message;
  messageBox.classList.remove('hidden', 'bg-green-500', 'bg-red-500');
  if (type === 'success') {
    messageBox.classList.add('bg-green-500');
  } else {
    messageBox.classList.add('bg-red-500');
  }
  messageBox.classList.add('block');
  setTimeout(() => {
    messageBox.classList.remove('block');
    messageBox.classList.add('hidden');
  }, 5000);
};

/**
 * Updates the UI based on the user's authentication state.
 * @param {object} user - The Firebase user object.
 */
const updateUI = (user) => {
  if (user) {
    // User is signed in. Hide auth UI, show app UI.
    userId = user.uid;
    authInfoEl.textContent = `Signed in as: ${user.email || 'Anonymous'}`;
    userIdDisplayEl.textContent = `User ID: ${userId}`;
    userIdDisplayEl.classList.remove('hidden');
    authContainer.classList.add('hidden');
    appContainer.classList.remove('hidden');
    signOutBtn.classList.remove('hidden');
    setupRealtimeListener();
    populateExerciseDropdown();
  } else {
    // User is signed out. Hide app UI, show auth UI.
    authInfoEl.textContent = 'Please sign in or create an account.';
    userIdDisplayEl.classList.add('hidden');
    authContainer.classList.remove('hidden');
    appContainer.classList.add('hidden');
    signOutBtn.classList.add('hidden');
    workoutsList.innerHTML = '';
  }
};

const progressSelectEl = document.getElementById('progress-exercise-select');
progressSelectEl.addEventListener('change', async (e) => {
  const selectedExercise = e.target.value;
  if (selectedExercise) {
    const workoutsQuery = query(
      collection(db, `artifacts/${appId}/users/${userId}/workouts`),
      where("exercise", "==", selectedExercise)
    );
    const snapshot = await getDocs(workoutsQuery);
    const workouts = snapshot.docs.map(doc => doc.data());
    renderProgressChart(workouts);
  }
});


/**
 * Initializes Firebase and authenticates the user.
 */
const initializeFirebase = async () => {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // This listener is the core of the authentication flow. It handles all UI state changes.
    onAuthStateChanged(auth, updateUI);

    // Add direct click listeners to the buttons to bypass form submission.
    signInBtn.addEventListener('click', () => handleAuthSubmit('signIn'));
    createAccountBtn.addEventListener('click', () => handleAuthSubmit('createAccount'));

    signOutBtn.addEventListener('click', handleSignOut);
    workoutForm.addEventListener('submit', handleFormSubmit);

    //Use event delegation for the delete buttons.
    workoutsList.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const workoutId = e.target.dataset.id;
        handleDeleteWorkout(workoutId);
      }
    });
  } catch (e) {
    console.error("Error initializing Firebase:", e);
    authInfoEl.textContent = 'Error initializing Firebase. Check console for details';
  }
};




/**
 * Sets up a real-time listener to fetch and display workouts from Firestore.
 */
const setupRealtimeListener = () => {
  if (!userId) {
    console.error("User ID not available.");
    return;
  }

  const workoutsCollection = collection(db, `artifacts/${appId}/users/${userId}/workouts`);

  onSnapshot(workoutsCollection, (snapshot) => {
    workoutsList.innerHTML = '';

    if (snapshot.empty) {
      workoutsList.innerHTML = '<p class="text-center text-gray-500">No workouts logged yet. Add one above!</p>';
      return;
    }

    snapshot.forEach((doc) => {
      const workout = doc.data();
      const workoutId = doc.id;
      const workoutItem = document.createElement('div');
      workoutItem.classList.add('bg-gray-50', 'rounded-xl', 'p-4', 'shadow-sm', 'flex', 'flex-col', 'md:flex-row', 'md:items-center', 'justify-between', 'space-y-2', 'md:space-y-0');

      const timestamp = workout.timestamp ? workout.timestamp.toDate().toLocaleString() : 'N/A';

      const workoutHTML = `
            <div>
                <p class="text-lg font-semibold text-gray-800">${workout.exercise}</p>
                <p class="text-sm text-gray-600">
                    <span class="font-medium">Sets:</span> ${workout.sets},
                    <span class="font-medium">Reps:</span> ${workout.reps},
                    <span class="font-medium">Weight:</span> ${workout.weight} lbs
                </p>
                <p class="text-xs text-gray-400 mt-1">
                    Logged on: ${timestamp}
                </p>
            </div>
            <button data-id="${workoutId}" class="delete-btn bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-md">
                Delete
            </button>
            `;
      workoutItem.innerHTML = workoutHTML;
      workoutsList.appendChild(workoutItem);
    });
  });
};

/**
 * Populates the dropdown menu with all unquie exercises logged by the user.
 */
const populateExerciseDropdown = async () => {
  if (!userId) {
    console.error("User ID not available to populate dropdown.");
    return;
  }

  const workoutsCollection = collection(db, `artifacts/${appId}/users/${userId}/workouts`);
  const snapshot = await getDocs(workoutsCollection);

  //Use a Set to store unique exercise names
  const exercises = new Set();
  snapshot.forEach((doc) => {
    const workout = doc.data();
    if (workout.exercise) {
      exercises.add(workout.exercise);
    }
  });

  //Clear existing options
  progressSelectEl.innerHTML = '';
  const defaultOption = document.createElement('option');
  defaultOption.textContent = "Select an exercise...";
  defaultOption.value = "";
  progressSelectEl.appendChild(defaultOption);

  //Add unique exercise to the dropdown
  exercises.forEach(exercise => {
    const option = document.createElement('option');
    option.value = exercise;
    option.textContent = exercise;
    progressSelectEl.appendChild(option);
  });

  //Automatically select the first exercise and trigger a change to load the chart
  if (exercises.size > 0) {
    const firstExercise = exercises.values().next().value;
    progressSelectEl.value = firstExercise;
    //Dispatching a new 'change' event to trigger the chart
    progressSelectEl.dispatchEvent(new Event('change'));
  }
};

/**
 * Handles the form submission to log a new workout.
 * @param {Event} e - The form submission event.
 */
const handleFormSubmit = async (e) => {
  e.preventDefault();

  if (!userId) {
    showMessage("Please sign in or create an account to log workouts.", 'error');
    return;
  }

  const exercise = document.getElementById('exercise').value.trim();
  const sets = parseInt(document.getElementById('sets').value, 10);
  const reps = parseInt(document.getElementById('reps').value, 10);
  const weight = parseFloat(document.getElementById('weight').value);

  if (!exercise || isNaN(sets) || isNaN(reps) || isNaN(weight)) {
    showMessage("Please fill out all fields with valid numbers.", 'error');
    return;
  }

  try {
    const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/workouts`), {
      exercise: exercise,
      sets: sets,
      reps: reps,
      weight: weight,
      timestamp: serverTimestamp()
    });

    console.log("Workout logged with ID:", docRef.id);
    workoutForm.reset();
    showMessage("Workout logged successfully!", 'success');
  } catch (e) {
    console.error("Error adding document: ", e);
    showMessage("Failed to log workout. Check console for details.", 'error');
  }
};

/**
 * Handles the authentication form submission.
 * @param {string} action - 'signIn' or 'createAccount'.
 */
const handleAuthSubmit = async (action) => {
  const email = authEmailInput.value;
  const password = authPasswordInput.value;

  if (!email || !password) {
    showMessage("Please enter both email and password.", 'error');
    return;
  }

  try {
    if (action === 'signIn') {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Signed in successfully.");
      showMessage("Signed in successfully!", 'success');
    } else {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("Account created successfully.");
      showMessage("Account created and signed in successfully!", 'success');
    }
  } catch (e) {
    console.error("Authentication error: ", e);
    if (e.code === 'auth/email-already-in-use') {
      showMessage("Email already in use. Please sign in instead.", 'error');
    } else if (e.code === 'auth/invalid-email' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
      showMessage("Invalid email or password.", 'error');
    } else if (e.code === 'auth/weak-password') {
      showMessage("Password is too weak. Please use at least 6 characters.", 'error');
    } else {
      showMessage(`Authentication failed: ${e.message}`, 'error');
    }
  }
};

/**
 * Handles the deletion of a workout.
 * @param {string} workoutId - The ID of the workout to delete.
 */
const handleDeleteWorkout = async (workoutId) => {
  if (!userId) {
    console.error("User ID not available for deletion.");
    return;
  }

  try {
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/workouts`, workoutId);
    await deleteDoc(docRef);
    console.log("Workout deleted successfully.");
    showMessage("Workout deleted successfully.", 'success');
  } catch (e) {
    console.error("Error deleting document: ", e);
    showMessage("Failed to delete workout. Check console for details.", 'error');
  }
};

/**
 * Handles the sign-out process.
 */
const handleSignOut = async () => {
  try {
    await signOut(auth);
    showMessage("Signed out successfully!", 'success');
    console.log("User signed out.");
  } catch (e) {
    console.error("Error signing out:", e);
    showMessage("Failed to sign out. Check console for details.", 'error');
  }
};

const renderProgressChart = (workouts) => {
  const chartCanvas = document.getElementById('progress-chart-container');
  if (!chartCanvas) {
    console.error("Canvas element not found. Cahrt cannot be rendered.");
    return;
  }
  const ctx = chartCanvas.getContext('2d');

  //Check if the context is valid
  if(!ctx) {
    console.error("2D context not available.  Check your browser or canvas element.");
    return;
  }

  //Clear any existing chart instances to prevent conflicts
  if(chartCanvas.chart) {
    chartCanvas.chart.destroy();
  }

  //Ssort workouts by timestampa to ensure the chart is chronological
  workouts.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate());

  const labels = workouts.map(w => w.timestamp.toDate().toLocaleDateString());
  const data = workouts.map(w => w.weight);

  //Store the new chart instance on the canvas element for future destruction
  chartCanvas.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Weight Lifted (lbs)',
        data: data,
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }]
    },
    options: {
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
};


// Initialize the app on window load
window.onload = initializeFirebase;
