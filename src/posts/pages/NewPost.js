import React, { useState, useContext, useEffect, useCallback } from "react";
import Input from "../../shared/components/FormElements/Input";
import Button from "../../shared/components/FormElements/Button";
import ErrorModal from "../../shared/components/UIElements/ErrorModal";
import LoadingSpinner from "../../shared/components/UIElements/LoadingSpinner";
import { useHttpClient } from "../../shared/hooks/http-hook";
import { useNavigate } from "react-router-dom";
import {
  VALIDATOR_MINLENGTH,
  VALIDATOR_REQUIRE,
} from "../../shared/util/validators";
import { useForm } from "../../shared/hooks/form-hook";
import { BlogContext } from "../../shared/contex/blog-context";
import { API_URL } from "../../api";
import "./NewPost.css";

function NewPost() {
  const { isLoading, error, sendRequest, clearError } = useHttpClient();
  const [formState, inputHandler] = useForm({
    title: {
      value: "",
      isValid: false,
    },
    blog: {
      value: "",
      isValid: false,
    },
    category: {
      value: "",
      isValid: false,
    },
    description: {
      value: "",
      isValid: false,
    },
  });

  const navigate = useNavigate();
  const { blogs } = useContext(BlogContext);

  // Initialize state variables
  const [fbText, setFbText] = useState("");
  const [translation, setTranslation] = useState("");
  const [dynamicImageSrc, setDynamicImageSrc] = useState(
    "https://picsum.photos/id/568/720/720"
  );

  const [isTranslating, setIsTranslating] = useState(false);
  const [translateError, setTranslateError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [wordCount, setWordCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    const selectedBlog = blogs.find(
      (blog) => blog.id === formState.inputs.blog.value
    );
    if (selectedBlog) {
      setCategories(selectedBlog.tags);
    } else {
      setCategories([]);
    }
  }, [formState.inputs.blog.value, blogs]);

  const translateHandler = async () => {
    const descriptionText = formState.inputs.description.value;
    setIsTranslating(true);
    setTranslateError(null);

    try {
      const response = await fetch(`${API_URL}/api/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formState.inputs.title.value,
          pre_prompt: descriptionText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch FB post from the GPT model");
      }
      const data = await response.json();
      const predictionContent = data.predictions[0].content;
      setFbText(predictionContent);
    } catch (err) {
      setTranslateError(err.message);
      console.error(err.message);
    }
  };

  useEffect(() => {
    const translateText = async () => {
      if (fbText === "") return;

      try {
        const response = await fetch(`${API_URL}/api/translate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: fbText,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to fetch translation from the API");
        }
        const data = await response.json();
        const translatedText = data.translations[0];
        setTranslation(translatedText);
      } catch (err) {
        setTranslateError(err.message);
        console.error(err.message);
      } finally {
        setIsTranslating(false);
        setDynamicImageSrc("https://picsum.photos/id/478/720/720");
      }
    };

    translateText();
  }, [fbText]);

  const descriptionChangeHandler = useCallback(
    (id, value, isValid) => {
      inputHandler(id, value, isValid);
      const words = value.trim().split(/\s+/);
      setWordCount(words.filter((word) => word.length > 0).length);
    },
    [inputHandler]
  );

  function loadPhotoHandler(event) {
    event.preventDefault();
    if (!formState.isValid) return;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = false;

    fileInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file && file.type.startsWith("image/")) {
        const img = new Image();
        img.src = URL.createObjectURL(file);

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const scale = Math.max(720 / img.width, 720 / img.height);
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;

          canvas.width = scaledWidth;
          canvas.height = scaledHeight;
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);

          const cropCanvas = document.createElement("canvas");
          const cropCtx = cropCanvas.getContext("2d");
          cropCanvas.width = 720;
          cropCanvas.height = 720;

          const startX = 0;
          const startY = scaledHeight - 720;

          cropCtx.drawImage(canvas, startX, startY, 720, 720, 0, 0, 720, 720);

          cropCanvas.toBlob((blob) => {
            setSelectedImage(blob);
          }, "image/jpeg");
        };
      }
    };

    fileInput.click();
  }

  async function genImageHandler(event) {
    event.preventDefault();
    if (!formState.isValid) return;
    setIsTranslating(true);
    try {
      const response = await fetch(`${API_URL}/api/generate-image`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: translation,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate image from the model");
      }
      const data = await response.json();
      const base64Image = data.imageBase64;
      const byteCharacters = atob(base64Image);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const imageBlob = new Blob([byteArray], { type: "image/jpeg" });
      console.log(
        `Blob {size: ${imageBlob.size / 1024}, type: '${imageBlob.type}'}`
      );
      const img = new Image();
      const url = URL.createObjectURL(imageBlob);

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 720;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 720, 720);
        canvas.toBlob((resizedBlob) => {
          const sizeInMB = resizedBlob.size / (1024 * 1024);
          console.log(
            `Resized Blob {size: ${sizeInMB.toFixed(2)} MB, type: '${
              resizedBlob.type
            }'}`
          );
          setSelectedImage(resizedBlob);
          URL.revokeObjectURL(url);
        }, "image/jpeg");
      };

      img.src = url;
      setSelectedImage(imageBlob);
    } catch (err) {
      console.error(err.message);
    } finally {
      setIsTranslating(false);
    }
  }

  async function postSubmitHandler(event) {
    event.preventDefault();

    const postId = new Date().toISOString();

    const formData = new FormData();
    formData.append("postID", postId);
    formData.append("title", formState.inputs.title.value);
    formData.append("tag", formState.inputs.category.value);
    formData.append("post", formState.inputs.description.value);
    formData.append("post_ua", fbText);
    formData.append("post_en", translation);
    formData.append("bid", formState.inputs.blog.value);

    if (selectedImage) {
      formData.append("image", selectedImage, "image.jpg");
    }
    try {
      await sendRequest(`${API_URL}/api/posts`, "POST", formData);
      navigate(`/${formState.inputs.blog.value}/posts`);
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <>
      <ErrorModal
        error={error || translateError}
        onClear={() => {
          clearError();
          setTranslateError(null);
        }}
      />
      <form className="post-form" onSubmit={postSubmitHandler}>
        {isLoading || isTranslating ? <LoadingSpinner asOverlay /> : null}
        <div className="title-selector-container">
          <Input
            id="title"
            element="input"
            type="text"
            label="Title"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Please enter a valid title."
            onInput={inputHandler}
          />
          <Input
            id="blog"
            element="select"
            label="Blog"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Please select a blog."
            onInput={inputHandler}
            options={blogs.map((blog) => ({
              value: blog.id,
              label: blog.title,
            }))}
          />
          <Input
            id="category"
            element="select"
            label="Category"
            validators={[VALIDATOR_REQUIRE()]}
            errorText="Please select a category."
            onInput={inputHandler}
            options={categories.map((category) => ({
              value: category,
              label: category,
            }))}
          />
        </div>
        <Input
          id="description"
          element="textarea"
          label={`Description (${wordCount} words)`}
          validators={[VALIDATOR_MINLENGTH(5)]}
          errorText="Please enter a valid description."
          onInput={descriptionChangeHandler}
        />
        <Button
          type="button"
          onClick={translateHandler}
          disabled={!formState.isValid || isTranslating}
        >
          Generate
        </Button>
        <Button
          type="button"
          disabled={!formState.isValid}
          onClick={loadPhotoHandler}
        >
          Load Photo
        </Button>
        <Button
          type="button"
          disabled={!formState.isValid || isTranslating}
          onClick={genImageHandler}
        >
          ImeGen
        </Button>
        <div className="text-container">
          <textarea
            id="fb_text"
            placeholder="FB text"
            value={fbText}
            onChange={(e) => setFbText(e.target.value)}
          ></textarea>
          <textarea
            id="translation"
            placeholder="Translation"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          ></textarea>
        </div>
        <div className="button-container">
          <img
            id="dynamicImage"
            src={
              selectedImage
                ? URL.createObjectURL(selectedImage)
                : dynamicImageSrc
            }
            style={{ width: "80vw", height: "auto" }}
            alt="Dynamic"
          />
          <Button type="submit" disabled={!formState.isValid}>
            SAVE POST
          </Button>
        </div>
      </form>
    </>
  );
}

export default NewPost;
