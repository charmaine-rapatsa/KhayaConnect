async function readJson(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(data?.error || fallbackMessage);
    error.status = response.status;
    throw error;
  }
  if (!data) {
    const error = new Error(fallbackMessage);
    error.status = response.status;
    throw error;
  }
  return data;
}

export async function loginWithCsrf(phone, password, role) {
  const csrfResponse = await fetch("/api/csrf/", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const csrfData = await readJson(
    csrfResponse,
    "Unable to prepare a secure sign-in request."
  );

  const response = await fetch("/api/login/", {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRFToken": csrfData.csrf_token,
    },
    body: JSON.stringify({ phone, password, role }),
  });

  return readJson(response, "Sign in failed.");
}
