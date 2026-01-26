# Noble Nexus: Pre-generated Lifetime Code Protocol

## 1. Executive Summary
The **Pre-generated Lifetime Code** system is a secure, inclusive Two-Factor Authentication (2FA) method designed for the Noble Nexus platform. It ensures that students and users **without access to smartphones or email** can still benefit from high-security account protection. 

Unlike traditional 2FA which requires a dynamic code for every login, this system enables a **static, secure credential** (printed on a physical Access Card) that remains valid indefinitely until revoked.

---

## 2. Why This Method?
*   **Inclusivity:** Eliminates the barrier of needing a smartphone (Authenticator App) or active internet connection/device for Email OTPs during class.
*   **Reliability:** Physical cards do not run out of battery or lose signal.
*   **Security:** Adds a layer of "Something you have" (the card) to the standard "Something you know" (password), preventing unauthorized access even if a password is compromised.

---

## 3. How It Works

### The Credentials
Every user is assigned a unique **6-digit random numeric code** (e.g., `829301`). This code acts as a secondary password.

### For Teachers (Issuing Cards)
1.  **Log in** to the Teacher Dashboard.
2.  Navigate to the **Class Roster**.
3.  Click the **ID Badge Icon** <span style="font-family: 'Material Icons'; font-size: 14px; vertical-align: middle;">badge</span> next to a student's name.
4.  The system displays the student's unique code.
5.  Click **"Print Card"** to generate a physical copy.
6.  Hand the printed card securely to the student.

### For Students (Logging In)
1.  **Step 1:** Enter Username and Password on the login screen.
2.  **Step 2:** The system requests the "Pre-generated Lifetime Code."
3.  **Action:** Read the 6-digit number from the provided physical Access Card and type it in.
4.  **Result:** Success. Access is granted.

---

## 4. Security Protocols

### Lifetime Validity
*   **Persistence:** The code does **not expire** after a single use. It effectively serves as a permanent key card.
*   **Convenience:** Students do not need to request a new code every day. One card lasts for the entire semester/year.

### Lost or Stolen Cards (Revocation Protocol)
If a student reports a lost card, security is compromised. The strict protocol is as follows:

1.  **Report:** Student notifies the Teacher immediately.
2.  **Revoke:** Teacher opens the student's Access Card modal in the dashboard.
3.  **Regenerate:** Teacher clicks the red **"Regenerate"** button.
    *   *System Action:* The old code is instant deleted from the database. It will **never** work again.
    *   *System Action:* A new, completely random code is generated.
4.  **Reissue:** Teacher prints the new card only for the student.

---

## 5. Frequently Asked Questions (FAQ)

**Q: Can two students have the same code?**
A: No. The system generates random unique codes for every user to prevent collisions.

**Q: What if a student forgets their code at home?**
A: They cannot log in. This is a security feature. Ideally, they should keep the card in their wallet or school ID holder. In an emergency, a teacher can look up their code on the dashboard and verbally provide it (though printing is preferred).

**Q: Can I change my code myself?**
A: No. To maintain control and prevent accidental lockouts, only Teachers/Admins can regenerate codes.
