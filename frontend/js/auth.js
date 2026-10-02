const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

           if (!response.ok) {
                const errorMessage =
                    data?.error?.message ||
                    data?.detail ||
                    "";

                if (errorMessage.toLowerCase().includes("invalid login credentials")) {
                    alert("Account not found. Please register first.");
                } else {
                    alert(errorMessage || "Login failed. Please try again.");
                }

                return;
            }

            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token);
            localStorage.setItem("user_id", data.user_id);
            localStorage.setItem("user_email", data.email);

            alert("Login successful!");

            window.location.href = "/";

        } catch (error) {
            console.error("Login error:", error);
            alert("Unable to connect to server.");
        }
    });
}
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = document.getElementById("fullName").value;
        const email = document.getElementById("registerEmail").value;
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            alert("Confirm password does not match the password.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    full_name: fullName,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.detail || "";

                 if (
                     errorMessage.toLowerCase().includes("already") ||
                     errorMessage.toLowerCase().includes("registered") ||
                     errorMessage.toLowerCase().includes("exists")
                 ) {
                     alert("This email is already registered. Please login.");
                 } else {
                     alert(errorMessage || "Registration failed.");
                 }

                 return;
        }

            alert(data.message);

            window.location.href = "login.html";

        } catch (error) {
            console.error("Registration error:", error);
            alert("Unable to connect to server.");
        }
    });
}
const forgotPasswordForm = document.getElementById("forgotPasswordForm");

if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = document.getElementById("forgotEmail").value;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email
                })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.detail || "Password reset failed");
                return;
            }

            alert(data.message);

        } catch (error) {
            console.error("Forgot password error:", error);
            alert("Unable to connect to server.");
        }
    });
}
function logoutUser() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_id");
    localStorage.removeItem("user_email");

    window.location.href = "login.html";
}