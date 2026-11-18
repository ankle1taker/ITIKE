import { Suspense } from "react";
import LoginForm from "./login-form"


export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}