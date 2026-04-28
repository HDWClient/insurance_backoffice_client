import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh", background: "#0f172a", color: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "monospace", padding: "24px",
        }}>
          <div style={{ maxWidth: 600 }}>
            <div style={{ color: "#f87171", fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
              Application Error
            </div>
            <pre style={{
              background: "#1e293b", border: "1px solid #334155", borderRadius: 8,
              padding: 16, fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
