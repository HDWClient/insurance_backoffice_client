import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import * as meService from "../../services/meService";

// Call once after login; re-fetch after org switch or role changes.
export const fetchMyPermissions = createAsyncThunk("me/fetchMyPermissions", async (_, thunkAPI) => {
  try {
    return await meService.getMyPermissions();
  } catch (error) {
    return thunkAPI.rejectWithValue(error?.response?.data?.errorCode ?? "FETCH_FAILED");
  }
});

const meSlice = createSlice({
  name: "me",
  initialState: {
    permissions: [],   // [{ code, module, action }] — normalised by meService
    loading: false,
    errorCode: null,
  },
  reducers: {
    clearPermissions(state) {
      state.permissions = [];
      state.errorCode = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyPermissions.pending, (state) => {
        state.loading = true;
        state.errorCode = null;
      })
      .addCase(fetchMyPermissions.fulfilled, (state, action) => {
        state.loading = false;
        state.permissions = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchMyPermissions.rejected, (state, action) => {
        state.loading = false;
        state.errorCode = action.payload;
      });
  },
});

export const { clearPermissions } = meSlice.actions;
export default meSlice.reducer;
