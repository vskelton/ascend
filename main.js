import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, addDoc, deleteDoc, onSnapshot, collection } from  "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

//UI elements
const authInfoEl = document.getElementById('auth-info');
const workoutForm = document.getElementById('workout-form');
const workoutsList = document.getElementById('workouts-list');
const loadingSpinner = document.getElementById('load-spinner');

//Firebase instances
let app, auth, db, userId;

/**
 * Initializes Firebase and authenticates the user
 */
const initializeFirebase = async () => {
  try {
    //Check if firebaseConfig is valid before initializing
    if (!firebaseConfig || Object.keys(firebaseConfig).length === 0) {
      console.error("Error: Firebase configuration is missing or invalid.");
      authInfoEl.textContent = 'Error: Firebase configuration is missing. Please check your environment.';
      return;
    }
    
    //Initialize Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Check for the provided custom auth token and sign in
    if (initialAuthToken) {
      await signInWithCustomToken(auth, initialAuthToken);
    } else {
      // Fallback to anonymous sign-in if no token is provided
      await signInAnonymously(auth);
    }

    // Set up the auth state listener to get the User Id
    onAuthStateChanged(auth, (user) => {
      if (user) {
        userId = user.uid;
        authInfoEl.textContent = `Signed in as: ${userId}`;
        // Once authenticated, start listening for workouts
        setupRealtimeListener();
      } else {
        // User is signed out, handle accordingly
        authInfoEl.textContent = 'Signed out. Please refresh to sign in.';
        workoutsList.innerHTML = '<p class="text-center text-gray-500">Please sign in to view your workouts.</p>';

      }
    });
  } catch (e) {
    console.error("Error initializing Firebase:", e);
    authInfoEl.textContent = `Error initializing Firebase. Check console for details.`; 
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

  //Use onSnapshot to listen for real-time changes
  onSnapshot(workoutsCollection, (snapshot) => {
    loadingSpinner.style.display = 'none';
    workoutsList.innerHTML = ''; //Clear the current list

    if (snapshot.empty) {
      workoutsList.innerHTML = '<p class="text-center text-gray-500">No workouts logged yet. Add one above!</p>';
      return;
    }

    snapshot.forEach((doc) => {
      const workout = doc.data();
      const workoutId = doc.id;
      const workoutItem = document.createElement('div');
      workoutItem.classList.add('bg-gray-50', 'rounded-xl', 'p-4', 'shadow-sm', 'flex', 'flex-col', 'md:items-center', 'justify-between', 'space-y-2', 'md:space-y-0');

      //Format the workout data for display
      const workoutHTML = `
      <div>
        <p class="text-lg font-semibold text-gray-800">${workout.exercise}</p>
        <p class="text-sm text-gray-600">
          <span class="font-medium">Sets:</span> ${workout.sets},
          <span class="font-medium">Reps:</span> ${workout.reps},
          <span class="font-medium">Weight:</span> ${workout.weight} lbs
          </p>
          <p class="text-xs text-gray-400 mt-1">
          Logged on: ${new Date(workout.timestamp.seconds * 1000).toLocaleString()}
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
 * Handles the form submission to log a new workout.
 * @param {Event} e - The form submission event.
 */
const handleFormSubmit = async (e) => {
  e.preventDefault();

  if (!userId) {
    alert("Please wait for authentication to complete before logging a workout.");
    return;
  }

  //Get form values
  const exercise = document.getElementById('exercise').value.trim();
  const sets= parseint(document.getElementById('sets').value, 10);
  const reps = parseInt(document.getElementById('reps').value, 10);
  const weight = parseFloat(document.getElementById('weight').value);

  //Basic validation
  if (!exercise || isNaN(sets) || isNaN(reps) || isNaN(weight)) {
    alert("Please fill out all field with valid numbers.");
    return;
  }

  try {
    //Add the new workout to Firestore
    const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/workouts`), {
      exercise: exercise,
      sets: sets,
      reps: reps,
      weight: weight,
      timestamp: new Date()
    });

    console.log("Workout logged with ID:", docRef.id);
    workoutForm.reset(); //Clear the form
} catch (e) {
  console.error("Error adding document: ", e);
  alert("Failed to log workout. Check console for details.");
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
  } catch (e) {
    console.error("Error deleting document: ", e);
    alert("Failed to delete workout. Check console for details.");
  }
};

//Event listeners
workoutForm.addEventListener('submit', handleFormSubmit);

// User event delegation for the delete buttons since they are added dynamically
workoutsList.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const workoutId = e.target.dataset.id;
    handleDeleteWorkout(workoutId);
  }
});

//Initialize the app on window load
window.onload = initializeFirebase;