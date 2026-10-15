Discord Music Bot

บอทเพลง Discord ใช้ Prefix ";"

คำสั่ง

- ";play ชื่อเพลง" ค้นหาเพลง
- ";queue" ดูคิวเพลง
- ";skip" ข้ามเพลง
- ";pause" พักเพลง
- ";resume" เล่นต่อ
- ";stop" หยุดเพลงและล้างคิว
- ";ping" ทดสอบบอท
- ";help" ดูคำสั่ง

ติดตั้ง

1. สร้าง Discord Application ที่ https://discord.com/developers/applications

2. เข้าเมนู Bot แล้วเปิด Message Content Intent

3. เชิญบอทเข้าเซิร์ฟเวอร์ โดยให้สิทธิ์ View Channels, Send Messages, Read Message History, Connect และ Speak

4. อัปโหลดไฟล์ "index.js", "package.json", ".gitignore" และ "README.md" เข้า Repository

5. เปิด GitHub Codespaces แล้วเปิด Terminal

6. สร้างไฟล์ ".env" ในโฟลเดอร์หลัก โดยใส่:
   
   DISCORD_TOKEN=ใส่โทเคนของบอทตรงนี้

7. ติดตั้งและเริ่มบอท:
   
   npm install
   npm start

8. ไป Discord แล้วลอง ";ping"

ความปลอดภัย

อย่าอัปโหลด ".env" หรือเปิดเผย Bot Token หาก Token หลุดให้ Reset ใน Discord Developer Portal ทันที

ข้อจำกัด

การค้นหาและสตรีมเพลงจาก YouTube อาจใช้ไม่ได้เมื่อแหล่งบริการเปลี่ยนระบบ โปรดปฏิบัติตามข้อกำหนดและลิขสิทธิ์ของแหล่งเพลง

GitHub Codespaces อาจหยุดเมื่อไม่มีการใช้งานหรือถึงขีดจำกัด จึงไม่รับประกันออนไลน์ 24 ชั่วโมง
