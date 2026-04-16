# Firebase CSV Import

## Files expected

Place these files in `C:\Users\Vydik\OneDrive\Documents` or set `FIREBASE_IMPORT_DIR`:

- `users.csv`
- `students.csv`
- `results.csv`
- `subjects.csv`

## Service account key

1. Firebase Console
2. Settings
3. Project settings
4. Service accounts
5. Generate new private key
6. Save the JSON file somewhere safe

## Run import

```powershell
$env:FIREBASE_SERVICE_ACCOUNT="C:\path\to\serviceAccountKey.json"
$env:FIREBASE_IMPORT_DIR="C:\Users\Vydik\OneDrive\Documents"
npm install
npm run import:firebase
```

## What it imports

- Firebase Authentication users from `users.csv`
- Firestore `users`
- Firestore `students`
- Firestore `subjects`
- Firestore `results`
- Firestore `notifications`
