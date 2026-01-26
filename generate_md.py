
def generate_logins_md():
    content = """# Test Login Credentials (60 Users)

Here are the login credentials for the demo.
**Note**: All accounts have 2FA enabled. The code is `123456` for everyone.

"""
    for grade in range(1, 6):
        content += f"""
## 🏫 Grade {grade} Class
**Teacher**: Can only see "Grade {grade}" students.
- **Username**: `teacher_g{grade}`
- **Password**: `teacher123`
- **2FA Code**: `123456`

### 🎓 Students (Grade {grade})
| # | Student ID | Name | Password | 2FA Code |
| :--- | :--- | :--- | :--- | :--- |
"""
        for i in range(1, 11):
            content += f"| {i} | `student_g{grade}_{i}` | Student G{grade}-{i} | `student123` | `123456` |\n"

    content += """
---
## 🛡 Super Admin (Principal)
**Access**: Can see **ALL** students (Grades 1-5).
- **Username**: `superadmin`
- **Password**: `admin123`
- **2FA Code**: `123456`
"""
    
    with open("gen_logins.md", "w") as f:
        f.write(content)

if __name__ == "__main__":
    generate_logins_md()
