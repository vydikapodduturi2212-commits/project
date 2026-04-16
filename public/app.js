// Using server authentication instead of Firebase

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

function getDashboardPath(role) {
  if (role === "admin") return "/admin.html";
  if (role === "faculty") return "/faculty.html";
  return "/student.html";
}

function showError(message) {
  loginError.hidden = false;
  loginError.textContent = message;
}



async function login(event) {
  event.preventDefault();
  loginError.hidden = true;

  try {
    const formData = new FormData(loginForm);
    const rollNumber = String(formData.get("rollNumber") || "").trim();
    const password = String(formData.get("password") || "");
    
    console.log("Attempting login", { rollNumber });
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rollNumber, password })
    });
    
    if (!response.ok) {
      let message = "Login failed";
      try {
        const error = await response.json();
        message = error.error || message;
      } catch (parseError) {
        console.error("Failed to parse login error response", parseError);
      }
      console.error("Login failed", response.status, message);
      throw new Error(message);
    }
    
    const data = await response.json();
    console.log("Login succeeded", data.user);
    localStorage.setItem("authToken", data.token);
    window.location.href = getDashboardPath(data.user.role);
  } catch (error) {
    showError(error.message || "Login failed");
  }
}

async function restoreSession() {
  const token = localStorage.getItem("authToken");
  if (!token) return;
  
  try {
    const response = await fetch("/api/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      window.location.href = getDashboardPath(data.user.role);
    } else {
      localStorage.removeItem("authToken");
    }
  } catch (error) {
    localStorage.removeItem("authToken");
  }
}

loginForm.addEventListener("submit", login);
restoreSession();
